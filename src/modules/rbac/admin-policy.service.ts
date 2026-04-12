import { ForbiddenException, Injectable } from '@nestjs/common';
import { TransactionType } from '@prisma/client';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';

@Injectable()
export class AdminPolicyService {
  assertHasPermission(user: AuthenticatedUser, permission: string) {
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenException(
        `Missing required permission: ${permission}`,
      );
    }
  }

  assertWalletTransactionAction(
    user: AuthenticatedUser,
    transactionType: TransactionType,
    approve: boolean,
  ) {
    if (transactionType === TransactionType.DEPOSIT) {
      if (approve) {
        this.assertHasPermission(user, 'deposits.approve');
        return;
      }

      this.assertHasPermission(user, 'transactions.view');
      return;
    }

    if (transactionType === TransactionType.WITHDRAW && approve) {
      this.assertHasPermission(user, 'withdrawals.approve');
      return;
    }

    this.assertHasPermission(user, 'transactions.view');
  }

  assertSettingsChange(user: AuthenticatedUser) {
    this.assertHasPermission(user, 'settings.manage');
  }

  assertSymbolConfigChange(user: AuthenticatedUser) {
    this.assertHasPermission(user, 'settings.manage');
  }

  assertHedgeActionChange(user: AuthenticatedUser) {
    this.assertHasPermission(user, 'dealingdesk.manage');
  }

  assertRoleAssignment(user: AuthenticatedUser) {
    this.assertHasPermission(user, 'users.manage');
  }
}
