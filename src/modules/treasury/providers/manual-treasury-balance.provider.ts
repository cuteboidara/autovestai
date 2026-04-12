import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { toNumber } from '../../../common/utils/decimal';
import { getTreasuryBalanceSnapshotModel } from '../treasury.prisma';
import {
  TreasuryBalanceObservation,
  TreasuryBalanceProvider,
  TreasuryBalanceProviderInput,
} from './treasury-balance-provider.interface';

@Injectable()
export class ManualTreasuryBalanceProvider implements TreasuryBalanceProvider {
  constructor(private readonly prismaService: PrismaService) {}

  async getObservedBalance(
    input: TreasuryBalanceProviderInput,
  ): Promise<TreasuryBalanceObservation | null> {
    const snapshot = await getTreasuryBalanceSnapshotModel(this.prismaService).findFirst({
      where: {
        asset: input.asset,
        network: input.network,
        walletAddress: input.walletAddress ?? undefined,
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.id,
      asset: snapshot.asset,
      network: snapshot.network,
      walletAddress: snapshot.walletAddress,
      balance: toNumber(snapshot.balance) ?? 0,
      source: snapshot.source.toLowerCase() as 'manual' | 'api',
      sourceReference: snapshot.sourceReference,
      observedAt: snapshot.observedAt,
      createdByUserId: snapshot.createdByUserId,
      createdAt: snapshot.createdAt,
      createdByUser: snapshot.createdByUser,
    };
  }
}
