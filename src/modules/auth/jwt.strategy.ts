import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly adminUsersService: AdminUsersService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const [user, authorization] = await Promise.all([
      this.usersService.findById(payload.sub),
      this.adminUsersService.getAdminAuthorization(payload.sub),
    ]);

    await this.sessionsService.validateSession(payload.sessionId);
    void this.sessionsService.touchSession(payload.sessionId);

    if (authorization && !authorization.isActive) {
      throw new UnauthorizedException('Admin account is inactive');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId: payload.sessionId,
      adminRole: authorization?.adminRole ?? null,
      permissions: authorization?.permissions ?? [],
      adminRoles: authorization?.adminRoles ?? [],
    };
  }
}
