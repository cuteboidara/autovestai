import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { PermissionsGuard } from '../../src/common/guards/permissions.guard';

describe('PermissionsGuard', () => {
  it('throws when the authenticated user is missing permissions', () => {
    const guard = new PermissionsGuard({
      getAllAndOverride: jest.fn().mockReturnValue(['settings.manage']),
    } as never);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            permissions: ['users.view'],
          },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
