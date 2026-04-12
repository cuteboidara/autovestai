import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { AdminChatController } from './admin-chat.controller';
import { AdminChatGateway } from './admin-chat.gateway';
import { AdminChatService } from './admin-chat.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
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
  controllers: [AdminChatController],
  providers: [AdminChatService, AdminChatGateway],
  exports: [AdminChatService, AdminChatGateway],
})
export class AdminChatModule {}
