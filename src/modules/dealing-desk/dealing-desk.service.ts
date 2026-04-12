import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HedgeActionStatus, HedgeActionType, OrderSide, PositionStatus } from '@prisma/client';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';
import { BrokerSettingsService } from '../admin/broker-settings.service';
import { AuditService } from '../audit/audit.service';
import { AdminPolicyService } from '../rbac/admin-policy.service';
import { SymbolsService } from '../symbols/symbols.service';
import { TradingEventsService } from '../trading/trading-events.service';

@Injectable()
export class DealingDeskService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly brokerSettingsService: BrokerSettingsService,
    private readonly adminPolicyService: AdminPolicyService,
    private readonly auditService: AuditService,
    private readonly symbolsService: SymbolsService,
    private readonly tradingEventsService: TradingEventsService,
  ) {}

  async getExposureOverview() {
    return Promise.all(
      this.symbolsService.listSymbols().map((symbol) => this.getExposureBySymbol(symbol.symbol)),
    );
  }

  async getExposureBySymbol(symbol: string) {
    const normalized = this.assertSymbol(symbol);
    const positions = await this.prismaService.position.findMany({
      where: {
        symbol: normalized,
        status: PositionStatus.OPEN,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    const longPositions = positions.filter((position) => position.side === OrderSide.BUY);
    const shortPositions = positions.filter((position) => position.side === OrderSide.SELL);
    const longVolume = longPositions.reduce(
      (sum, position) => sum + (toNumber(position.volume) ?? 0),
      0,
    );
    const shortVolume = shortPositions.reduce(
      (sum, position) => sum + (toNumber(position.volume) ?? 0),
      0,
    );
    const netVolume = Number((longVolume - shortVolume).toFixed(8));
    const weightedAvgLongPrice = this.calculateWeightedAveragePrice(longPositions);
    const weightedAvgShortPrice = this.calculateWeightedAveragePrice(shortPositions);
    const floatingPnlImpactEstimate = positions.reduce(
      (sum, position) => sum + (toNumber(position.pnl) ?? 0),
      0,
    );

    const concentrationByTopClients = positions
      .reduce<Map<string, { userId: string; email: string; volume: number }>>((map, position) => {
        const current = map.get(position.userId) ?? {
          userId: position.user.id,
          email: position.user.email,
          volume: 0,
        };

        current.volume += toNumber(position.volume) ?? 0;
        map.set(position.userId, current);
        return map;
      }, new Map())
      .values();

    const topClients = Array.from(concentrationByTopClients)
      .sort((left, right) => Math.abs(right.volume) - Math.abs(left.volume))
      .slice(0, 5);

    return {
      symbol: normalized,
      longVolume,
      shortVolume,
      netVolume,
      weightedAvgLongPrice,
      weightedAvgShortPrice,
      floatingPnlImpactEstimate,
      topClients,
    };
  }

  async listHedgeActions() {
    return this.prismaService.hedgeAction.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveHedgeAction(
    actionId: string,
    admin: AuthenticatedUser,
    reason?: string,
  ) {
    this.adminPolicyService.assertHedgeActionChange(admin);
    return this.updateHedgeActionStatus(
      actionId,
      HedgeActionStatus.APPROVED,
      reason,
      admin,
    );
  }

  async rejectHedgeAction(
    actionId: string,
    admin: AuthenticatedUser,
    reason?: string,
  ) {
    this.adminPolicyService.assertHedgeActionChange(admin);
    return this.updateHedgeActionStatus(
      actionId,
      HedgeActionStatus.REJECTED,
      reason,
      admin,
    );
  }

  async refreshAllExposure() {
    for (const symbol of this.symbolsService.listSymbols().map((item) => item.symbol)) {
      await this.updateExposureForSymbol(symbol);
    }
  }

  async updateExposureForSymbol(symbol: string) {
    const normalized = this.assertSymbol(symbol);
    const exposure = await this.getExposureBySymbol(normalized);

    const snapshot = await this.prismaService.symbolExposureSnapshot.create({
      data: {
        symbol: normalized,
        longVolume: toDecimal(exposure.longVolume),
        shortVolume: toDecimal(exposure.shortVolume),
        netVolume: toDecimal(exposure.netVolume),
        weightedAvgLongPrice:
          exposure.weightedAvgLongPrice !== null
            ? toDecimal(exposure.weightedAvgLongPrice)
            : null,
        weightedAvgShortPrice:
          exposure.weightedAvgShortPrice !== null
            ? toDecimal(exposure.weightedAvgShortPrice)
            : null,
      },
    });

    this.tradingEventsService.emitExposureUpdate({
      ...exposure,
      timestamp: snapshot.timestamp,
    });

    await this.maybeCreateHedgeSuggestion(exposure);

    return snapshot;
  }

  private async maybeCreateHedgeSuggestion(exposure: {
    symbol: string;
    netVolume: number;
  }) {
    const symbolConfig = this.brokerSettingsService.getSymbolConfig(exposure.symbol);
    const threshold = symbolConfig.maxExposureThreshold;

    if (Math.abs(exposure.netVolume) <= threshold) {
      return null;
    }

    const existingSuggestion = await this.prismaService.hedgeAction.findFirst({
      where: {
        symbol: exposure.symbol,
        status: {
          in: [HedgeActionStatus.SUGGESTED, HedgeActionStatus.APPROVED, HedgeActionStatus.SENT],
        },
      },
    });

    if (existingSuggestion) {
      return existingSuggestion;
    }

    const actionType =
      exposure.netVolume > 0 ? HedgeActionType.HEDGE_BUY : HedgeActionType.HEDGE_SELL;

    const action = await this.prismaService.hedgeAction.create({
      data: {
        symbol: exposure.symbol,
        actionType,
        volume: toDecimal(Math.abs(exposure.netVolume)),
        reason: `Net exposure ${exposure.netVolume} breached threshold ${threshold}`,
        status: HedgeActionStatus.SUGGESTED,
      },
    });

    this.tradingEventsService.emitHedgeActionCreated(action);
    return action;
  }

  private async updateHedgeActionStatus(
    actionId: string,
    status: HedgeActionStatus,
    reason?: string,
    admin?: AuthenticatedUser,
  ) {
    const action = await this.prismaService.hedgeAction.findUnique({
      where: { id: actionId },
    });

    if (!action) {
      throw new NotFoundException('Hedge action not found');
    }

    if (action.status === status) {
      return action;
    }

    if (action.status !== HedgeActionStatus.SUGGESTED) {
      throw new BadRequestException(
        'Only suggested hedge actions can be approved or rejected',
      );
    }

    const updated = await this.prismaService.hedgeAction.update({
      where: { id: actionId },
      data: {
        status,
        reason: reason ? `${action.reason} | ${reason}` : action.reason,
      },
    });

    if (admin) {
      await this.auditService.log({
        actorUserId: admin.id,
        actorRole: admin.role.toLowerCase(),
        action:
          status === HedgeActionStatus.APPROVED
            ? 'HEDGE_ACTION_APPROVED'
            : 'HEDGE_ACTION_REJECTED',
        entityType: 'hedge_action',
        entityId: updated.id,
        metadataJson: {
          symbol: updated.symbol,
          actionType: updated.actionType,
          reason: updated.reason,
        },
      });
    }

    return updated;
  }

  private calculateWeightedAveragePrice(
    positions: Array<{
      entryPrice: unknown;
      volume: unknown;
    }>,
  ) {
    const totalVolume = positions.reduce(
      (sum, position) => sum + (toNumber(position.volume as never) ?? 0),
      0,
    );

    if (totalVolume <= 0) {
      return null;
    }

    const totalNotional = positions.reduce((sum, position) => {
      return sum + (toNumber(position.entryPrice as never) ?? 0) * (toNumber(position.volume as never) ?? 0);
    }, 0);

    return Number((totalNotional / totalVolume).toFixed(8));
  }

  private assertSymbol(symbol: string) {
    return this.symbolsService.getSymbolOrThrow(symbol).symbol;
  }
}
