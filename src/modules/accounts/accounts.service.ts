import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { Account, AccountStatus, AccountType, OrderSide, PositionStatus, Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { ResponseCacheService } from '../../common/cache/response-cache.service';
import { accountSelect, positionSelect, transactionSelect } from '../../common/prisma/selects';
import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber, zeroDecimal } from '../../common/utils/decimal';
import {
  serializeAccount,
  serializeAccountAsWallet,
  serializeTransaction,
} from '../../common/utils/serializers';
import { AuditService } from '../audit/audit.service';
import { PositionsService } from '../positions/positions.service';
import { PricingService } from '../pricing/pricing.service';
import { TradingEventsService } from '../trading/trading-events.service';
import { CreateAccountDto } from './dto/create-account.dto';

const DEMO_STARTING_BALANCE = 10_000;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly responseCacheService: ResponseCacheService,
    private readonly pricingService: PricingService,
    private readonly auditService: AuditService,
    private readonly tradingEventsService: TradingEventsService,
    @Inject(forwardRef(() => PositionsService))
    private readonly positionsService: PositionsService,
  ) {}

  async getUserAccounts(userId: string) {
    const accounts = await this.prismaService.account.findMany({
      where: {
        userId,
        status: {
          not: AccountStatus.CLOSED,
        },
      },
      select: accountSelect,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });

    return Promise.all(accounts.map((account) => this.serializeAccountWithMetrics(account)));
  }

  async getAccountById(userId: string, accountId: string) {
    const account = await this.getOwnedAccountOrThrow(userId, accountId);
    return this.serializeAccountWithMetrics(account);
  }

  async createAccount(userId: string, dto: CreateAccountDto) {
    const existingCount = await this.prismaService.account.count({
      where: {
        userId,
        status: {
          not: AccountStatus.CLOSED,
        },
      },
    });
    const initialBalance = dto.type === AccountType.DEMO ? DEMO_STARTING_BALANCE : 0;
    const accountNo = await this.generateAccountNo(dto.type);
    const account = await this.prismaService.account.create({
      data: {
        userId,
        type: dto.type,
        name:
          dto.name?.trim() ||
          this.buildDefaultName(dto.type, existingCount + 1),
        accountNo,
        balance: toDecimal(initialBalance),
        equity: toDecimal(initialBalance),
        currency: 'USDT',
        status: AccountStatus.ACTIVE,
        isDefault: existingCount === 0,
      },
      select: accountSelect,
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'ACCOUNT_CREATED',
      entityType: 'account',
      entityId: account.id,
      targetUserId: userId,
      metadataJson: {
        accountType: account.type,
        accountNo: account.accountNo,
        isDefault: account.isDefault,
      },
    });

    if (account.isDefault) {
      await this.syncLegacyWalletSnapshot(userId, account.id);
    }

    await this.responseCacheService.invalidateUserResources(userId, [
      'accounts',
      'positions',
      'transactions',
    ]);

    return this.serializeAccountWithMetrics(account);
  }

  async setDefaultAccount(userId: string, accountId: string) {
    const account = await this.getOwnedAccountOrThrow(userId, accountId);

    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Only active accounts can be set as default');
    }

    await this.prismaService.$transaction([
      this.prismaService.account.updateMany({
        where: { userId },
        data: { isDefault: false },
      }),
      this.prismaService.account.update({
        where: { id: account.id },
        data: { isDefault: true },
      }),
    ]);

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'ACCOUNT_SET_DEFAULT',
      entityType: 'account',
      entityId: account.id,
      targetUserId: userId,
      metadataJson: {
        accountNo: account.accountNo,
        accountType: account.type,
      },
    });

    await this.syncLegacyWalletSnapshot(userId, account.id);
    await this.responseCacheService.invalidateUserResources(userId, [
      'accounts',
      'positions',
      'transactions',
    ]);
    return this.getAccountById(userId, account.id);
  }

  async resetDemoBalance(userId: string, accountId: string) {
    const account = await this.getOwnedAccountOrThrow(userId, accountId);

    if (account.type !== AccountType.DEMO) {
      throw new BadRequestException('Only demo accounts can be reset');
    }

    const openPositions = await this.prismaService.position.findMany({
      where: {
        accountId: account.id,
        status: PositionStatus.OPEN,
      },
      select: {
        id: true,
      },
      orderBy: { openedAt: 'asc' },
    });

    for (const position of openPositions) {
      await this.positionsService.closePositionBySystem(position.id, 'DEMO_RESET');
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: {
          balance: toDecimal(DEMO_STARTING_BALANCE),
          equity: toDecimal(DEMO_STARTING_BALANCE),
        },
      });

      await tx.transaction.create({
        data: {
          userId,
          accountId: account.id,
          walletId: null,
          type: TransactionType.TRADE,
          amount: new Prisma.Decimal(0),
          status: TransactionStatus.COMPLETED,
          asset: 'USDT',
          metadata: {
            action: 'RESET_DEMO_ACCOUNT',
            accountId: account.id,
            accountNo: account.accountNo,
            startingBalance: DEMO_STARTING_BALANCE,
          },
        },
      });
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'ACCOUNT_RESET_DEMO',
      entityType: 'account',
      entityId: account.id,
      targetUserId: userId,
      metadataJson: {
        accountNo: account.accountNo,
      },
    });

    if (account.isDefault) {
      await this.syncLegacyWalletSnapshot(userId, account.id);
    }

    await this.responseCacheService.invalidateUserResources(userId, [
      'accounts',
      'positions',
      'transactions',
    ]);

    return this.getAccountById(userId, account.id);
  }

  async closeAccount(userId: string, accountId: string) {
    const account = await this.getOwnedAccountOrThrow(userId, accountId);

    if (account.status === AccountStatus.CLOSED) {
      return { success: true };
    }

    const openPositions = await this.prismaService.position.count({
      where: {
        accountId: account.id,
        status: PositionStatus.OPEN,
      },
    });

    if (openPositions > 0) {
      throw new BadRequestException('Close all open positions before closing this account');
    }

    const fallbackAccount = account.isDefault
      ? await this.prismaService.account.findFirst({
          where: {
            userId,
            id: { not: account.id },
            status: AccountStatus.ACTIVE,
          },
          select: accountSelect,
          orderBy: { createdAt: 'asc' },
        })
      : null;

    await this.prismaService.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: account.id },
        data: {
          status: AccountStatus.CLOSED,
          isDefault: false,
        },
      });

      if (fallbackAccount) {
        await tx.account.update({
          where: { id: fallbackAccount.id },
          data: { isDefault: true },
        });
      }
    });

    await this.auditService.log({
      actorUserId: userId,
      actorRole: 'user',
      action: 'ACCOUNT_CLOSED',
      entityType: 'account',
      entityId: account.id,
      targetUserId: userId,
      metadataJson: {
        accountNo: account.accountNo,
      },
    });

    if (fallbackAccount) {
      await this.syncLegacyWalletSnapshot(userId, fallbackAccount.id);
    }

    await this.responseCacheService.invalidateUserResources(userId, [
      'accounts',
      'positions',
      'transactions',
    ]);

    return { success: true };
  }

  async getDefaultAccountOrThrow(userId: string) {
    const account = await this.prismaService.account.findFirst({
      where: {
        userId,
        status: {
          not: AccountStatus.CLOSED,
        },
        isDefault: true,
      },
      select: accountSelect,
    });

    if (account) {
      return account;
    }

    const fallback = await this.prismaService.account.findFirst({
      where: {
        userId,
        status: {
          not: AccountStatus.CLOSED,
        },
      },
      select: accountSelect,
      orderBy: { createdAt: 'asc' },
    });

    if (!fallback) {
      throw new NotFoundException('Account not found');
    }

    await this.prismaService.account.update({
      where: { id: fallback.id },
      data: { isDefault: true },
    });

    return {
      ...fallback,
      isDefault: true,
    };
  }

  async resolveAccountForUser(userId: string, accountId?: string | null) {
    if (accountId) {
      return this.getOwnedAccountOrThrow(userId, accountId);
    }

    return this.getDefaultAccountOrThrow(userId);
  }

  async resolveLiveAccountForUser(userId: string, accountId?: string | null) {
    const account = await this.resolveAccountForUser(userId, accountId);

    if (account.type !== AccountType.LIVE || account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        'Funding operations are only available for active LIVE accounts. Switch to a live account and retry.',
      );
    }

    return account;
  }

  async syncLegacyWalletSnapshot(userId: string, accountId?: string) {
    const account = accountId
      ? await this.getOwnedAccountOrThrow(userId, accountId)
      : await this.getDefaultAccountOrThrow(userId);
    const [metrics, transactions] = await Promise.all([
      this.getAccountMetrics(account),
      this.prismaService.transaction.findMany({
        where: {
          userId,
          accountId: account.id,
        },
        select: transactionSelect,
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    await this.prismaService.wallet.upsert({
      where: { userId },
      create: {
        userId,
        balance: toDecimal(metrics.balance),
        lockedMargin: toDecimal(metrics.usedMargin),
      },
      update: {
        balance: toDecimal(metrics.balance),
        lockedMargin: toDecimal(metrics.usedMargin),
      },
    });

    this.tradingEventsService.emitWalletUpdate(userId, {
      wallet: serializeAccountAsWallet(account, metrics),
      // FIX: Keep wallet websocket payload shape consistent with the REST snapshot
      // so dashboard and wallet activity do not get wiped by incremental updates.
      transactions: transactions.map(serializeTransaction),
      activeAccountId: account.id,
    });
  }

  async getAccountMetrics(accountOrId: Account | string) {
    const account =
      typeof accountOrId === 'string'
        ? await this.prismaService.account.findUnique({
            where: { id: accountOrId },
            select: accountSelect,
          })
        : accountOrId;

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const openPositions = await this.prismaService.position.findMany({
      where: {
        accountId: account.id,
        status: PositionStatus.OPEN,
      },
      select: positionSelect,
      orderBy: { openedAt: 'asc' },
    });

    // Batched: all DB reads happen before this loop. No async calls inside.
    const uniqueSymbols = [...new Set(openPositions.map((p) => p.symbol))];
    const quoteResults = await Promise.all(
      uniqueSymbols.map((s) => this.pricingService.getLatestQuote(s)),
    );
    const quoteMap = new Map(uniqueSymbols.map((s, i) => [s, quoteResults[i]]));

    const pnlValues = openPositions.map((position) => {
      const quote = quoteMap.get(position.symbol);
      if (!quote) return 0;
      const entryPrice = toDecimal(position.entryPrice);
      const volume = toDecimal(position.volume);
      const contractSize = toDecimal(position.contractSize);

      if (position.side === OrderSide.BUY) {
        return toDecimal(quote.bid)
          .minus(entryPrice)
          .mul(volume)
          .mul(contractSize)
          .toDecimalPlaces(8)
          .toNumber();
      }

      return entryPrice
        .minus(quote.ask)
        .mul(volume)
        .mul(contractSize)
        .toDecimalPlaces(8)
        .toNumber();
    });

    const unrealizedPnl = pnlValues
      .reduce((sum, pnl) => sum.plus(pnl), zeroDecimal())
      .toDecimalPlaces(8)
      .toNumber();
    const usedMargin = openPositions
      .reduce((sum, position) => sum.plus(position.marginUsed), zeroDecimal())
      .toDecimalPlaces(8)
      .toNumber();
    const balance = toNumber(account.balance) ?? 0;
    const equity = toDecimal(balance).plus(unrealizedPnl).toDecimalPlaces(8).toNumber();
    const freeMargin = toDecimal(equity).minus(usedMargin).toDecimalPlaces(8).toNumber();
    const marginLevel =
      usedMargin <= 0
        ? null
        : toDecimal(equity).div(usedMargin).mul(100).toDecimalPlaces(8).toNumber();

    if ((toNumber(account.equity) ?? 0) !== equity) {
      await this.prismaService.account.update({
        where: { id: account.id },
        data: {
          equity: toDecimal(equity),
        },
      });
    }

    return {
      account,
      balance,
      equity,
      unrealizedPnl,
      usedMargin,
      freeMargin,
      marginLevel,
      openPositions: openPositions.length,
    };
  }

  private async getOwnedAccountOrThrow(userId: string, accountId: string) {
    const account = await this.prismaService.account.findFirst({
      where: {
        id: accountId,
        userId,
      },
      select: accountSelect,
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    return account;
  }

  private async serializeAccountWithMetrics(account: Account) {
    const metrics = await this.getAccountMetrics(account);
    return serializeAccount(account, metrics);
  }

  private buildDefaultName(type: AccountType, sequence: number) {
    if (type === AccountType.DEMO) {
      return sequence === 1 ? 'Demo Account' : `Demo Account #${sequence}`;
    }

    return `Live Account #${sequence}`;
  }

  private async generateAccountNo(type: AccountType) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const prefix = type === AccountType.DEMO ? 'DM' : 'FF';
      const candidate = `${prefix}${randomBytes(3).toString('hex').toUpperCase()}`.slice(0, 8);
      const existing = await this.prismaService.account.findUnique({
        where: { accountNo: candidate },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new BadRequestException('Unable to generate a unique account number');
  }
}
