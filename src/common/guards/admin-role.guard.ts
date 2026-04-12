import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new ForbiddenException('Missing authenticated user context');
    }

    if (
      user.adminRole === 'SUPER_ADMIN' ||
      user.adminRoles.some((role) => role.name === 'super_admin')
    ) {
      return true;
    }

    const missingPermissions = requiredPermissions.filter(
      (permission) => !user.permissions.includes(permission),
    );

    if (missingPermissions.length > 0) {
      throw new ForbiddenException(
        `Missing required permissions: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
