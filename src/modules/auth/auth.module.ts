import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { BrokerSettingsModule } from '../admin/broker-settings.module';
import { AdminUsersModule } from '../admin-users/admin-users.module';
import { AdminChatModule } from '../admin-chat/admin-chat.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { AuditModule } from '../audit/audit.module';
import { CrmModule } from '../crm/crm.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SurveillanceModule } from '../surveillance/surveillance.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    AdminChatModule,
    AdminUsersModule,
    AffiliatesModule,
    AuditModule,
    BrokerSettingsModule,
    CrmModule,
    SessionsModule,
    SurveillanceModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.getOrThrow<string>('jwt.expiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
