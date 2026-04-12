import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type TreasuryBalanceSourceRecord = 'MANUAL' | 'API';

export interface TreasurySnapshotRecord {
  id: string;
  asset: string;
  network: string;
  walletAddress: string;
  balance: Prisma.Decimal;
  source: TreasuryBalanceSourceRecord;
  sourceReference: string | null;
  observedAt: Date;
  createdByUserId: string | null;
  createdAt: Date;
  createdByUser: {
    id: string;
    email: string;
  } | null;
}

interface TreasuryBalanceSnapshotModel {
  findFirst(args: {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    orderBy?: Array<Record<string, unknown>>;
  }): Promise<TreasurySnapshotRecord | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    orderBy?: Array<Record<string, unknown>>;
    take?: number;
  }): Promise<TreasurySnapshotRecord[]>;
  create(args: {
    data: Record<string, unknown>;
    include?: Record<string, unknown>;
  }): Promise<TreasurySnapshotRecord>;
}

export function getTreasuryBalanceSnapshotModel(
  prismaService: PrismaService,
): TreasuryBalanceSnapshotModel {
  return (
    prismaService as unknown as {
      treasuryBalanceSnapshot: TreasuryBalanceSnapshotModel;
    }
  ).treasuryBalanceSnapshot;
}
