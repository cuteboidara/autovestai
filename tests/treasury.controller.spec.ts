import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { TreasuryController } from '../src/modules/treasury/treasury.controller';

function createContext(
  handler: unknown,
  permissions: string[],
): ExecutionContext {
  return {
    getHandler: () => handler as (...args: unknown[]) => unknown,
    getClass: () => TreasuryController,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          permissions,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('TreasuryController permissions', () => {
  it('requires treasury.view on summary access', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createContext(TreasuryController.prototype.getSummary, ['wallet.review']),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        createContext(TreasuryController.prototype.getSummary, ['treasury.view']),
      ),
    ).toBe(true);
  });

  it('requires treasury.manage on snapshot creation', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createContext(TreasuryController.prototype.createBalanceSnapshot, ['treasury.view']),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        createContext(TreasuryController.prototype.createBalanceSnapshot, ['treasury.manage']),
      ),
    ).toBe(true);
  });
});
