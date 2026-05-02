import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { toNumber } from '../../common/utils/decimal';
import { BalanceLedgerService } from '../balance-ledger/balance-ledger.service';

@Injectable()
export class DataIntegrityService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DataIntegrityService.name);
  private timer?: NodeJS.Timeout;

  // Run once daily at 02:00 UTC — approximated via interval from startup
  private readonly intervalMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly balanceLedgerService: BalanceLedgerService,
  ) {}

  onModuleInit(): void {
    // Run initial check after a short delay so the app is fully started
    const initialDelayMs = 60_000;
    setTimeout(() => {
      void this.runIntegrityCheck();
      this.timer = setInterval(() => {
        void this.runIntegrityCheck();
      }, this.intervalMs);
    }, initialDelayMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runIntegrityCheck(): Promise<{ checked: number; mismatches: number }> {
    this.logger.log('Starting balance ledger integrity check');

    const accounts = await this.prismaService.account.findMany({
      select: { id: true, userId: true, accountNo: true, balance: true },
    });

    let mismatches = 0;

    for (const account of accounts) {
      try {
        await this.checkAccount(account);
      } catch (error) {
        this.logger.error(
          `Integrity check failed for account ${account.accountNo}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Integrity check complete: ${accounts.length} accounts checked, ${mismatches} mismatches found`,
    );

    return { checked: accounts.length, mismatches };
  }

  private async checkAccount(account: {
    id: string;
    userId: string;
    accountNo: string;
    balance: unknown;
  }): Promise<void> {
    const ledgerSum = await this.balanceLedgerService.computeLedgerSum(account.id);
    const accountBalance = toNumber(account.balance as Parameters<typeof toNumber>[0]) ?? 0;

    const delta = Math.abs(ledgerSum - accountBalance);
    const TOLERANCE = 0.000_000_01; // 1 satoshi

    if (delta > TOLERANCE) {
      this.logger.error(
        `BALANCE MISMATCH — account ${account.accountNo} (${account.id}): ` +
          `ledger_sum=${ledgerSum.toFixed(8)}, account_balance=${accountBalance.toFixed(8)}, ` +
          `delta=${delta.toFixed(8)}`,
      );

      // Record mismatch in audit log via direct DB write to avoid circular dependencies
      await this.prismaService.auditLog.create({
        data: {
          actorRole: 'system',
          action: 'BALANCE_INTEGRITY_MISMATCH',
          entityType: 'account',
          entityId: account.id,
          targetUserId: account.userId,
          metadataJson: {
            accountNo: account.accountNo,
            ledgerSum,
            accountBalance,
            delta,
          } as Prisma.InputJsonObject,
        },
      });
    }
  }
}
