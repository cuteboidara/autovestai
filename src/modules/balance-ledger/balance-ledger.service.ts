import { Injectable, Logger } from '@nestjs/common';
import { LedgerEntryType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toDecimal, toNumber } from '../../common/utils/decimal';

export interface AppendLedgerEntryParams {
  accountId: string;
  userId: string;
  type: LedgerEntryType;
  amountChange: number;
  balanceAfter: number;
  referenceId?: string;
  referenceType?: string;
  description?: string;
}

@Injectable()
export class BalanceLedgerService {
  private readonly logger = new Logger(BalanceLedgerService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async appendEntry(
    params: AppendLedgerEntryParams,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prismaService;
    await client.balanceLedger.create({
      data: {
        accountId: params.accountId,
        userId: params.userId,
        type: params.type,
        amountChange: toDecimal(params.amountChange),
        balanceAfter: toDecimal(params.balanceAfter),
        referenceId: params.referenceId ?? null,
        referenceType: params.referenceType ?? null,
        description: params.description ?? null,
      },
    });
  }

  async getEntriesForAccount(accountId: string, take = 100, skip = 0) {
    return this.prismaService.balanceLedger.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  /**
   * Returns the sum of all ledger entries for an account.
   * Used by the data integrity check to verify balance consistency.
   */
  async computeLedgerSum(accountId: string): Promise<number> {
    const result = await this.prismaService.balanceLedger.aggregate({
      where: { accountId },
      _sum: { amountChange: true },
    });
    return toNumber(result._sum.amountChange) ?? 0;
  }

  /**
   * Returns the last ledger entry's balanceAfter for an account,
   * which should always match account.balance.
   */
  async getLastBalance(accountId: string): Promise<number | null> {
    const entry = await this.prismaService.balanceLedger.findFirst({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: { balanceAfter: true },
    });
    return entry ? (toNumber(entry.balanceAfter) ?? null) : null;
  }
}
