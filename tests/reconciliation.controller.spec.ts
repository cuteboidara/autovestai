import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionsGuard } from '../src/common/guards/permissions.guard';
import { ReconciliationController } from '../src/modules/reconciliation/reconciliation.controller';

function createContext(
  handler: unknown,
  permissions: string[],
): ExecutionContext {
  return {
    getHandler: () => handler as (...args: unknown[]) => unknown,
    getClass: () => ReconciliationController,
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          permissions,
        },
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('ReconciliationController permissions', () => {
  it('requires treasury.manage on run access', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createContext(ReconciliationController.prototype.runNow, ['treasury.view']),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        createContext(ReconciliationController.prototype.runNow, ['treasury.manage']),
      ),
    ).toBe(true);
  });

  it('requires treasury.view on latest/list/detail access', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(() =>
      guard.canActivate(
        createContext(ReconciliationController.prototype.getLatest, ['wallet.review']),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(
        createContext(ReconciliationController.prototype.listRuns, ['wallet.review']),
      ),
    ).toThrow(ForbiddenException);

    expect(() =>
      guard.canActivate(
        createContext(ReconciliationController.prototype.getRun, ['wallet.review']),
      ),
    ).toThrow(ForbiddenException);

    expect(
      guard.canActivate(
        createContext(ReconciliationController.prototype.getLatest, ['treasury.view']),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(ReconciliationController.prototype.listRuns, ['treasury.view']),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        createContext(ReconciliationController.prototype.getRun, ['treasury.view']),
      ),
    ).toBe(true);
  });
});
