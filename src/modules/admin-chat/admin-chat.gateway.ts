import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { ADMIN_CHAT_CHANNELS, AdminChatChannel } from './admin-chat.constants';

@WebSocketGateway({
  cors: {
    origin:
      process.env.CORS_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? ['http://localhost:3000', 'http://localhost:3001'],
  },
  namespace: 'admin-chat',
})
export class AdminChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AdminChatGateway.name);
  private readonly connectedAdmins = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    const token = this.extractToken(client);
    const providedAdminPath = this.extractAdminPath(client);
    const expectedAdminPath =
      this.configService.get<string>('app.adminPath') ?? 'control-tower';

    if (!token || providedAdminPath !== expectedAdminPath) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (String(payload.role).toUpperCase() !== 'ADMIN') {
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.sub;
      client.data.userRole = 'ADMIN';

      for (const channel of ADMIN_CHAT_CHANNELS) {
        client.join(this.buildChannelRoom(channel));
      }

      const activeSockets = this.connectedAdmins.get(payload.sub) ?? new Set<string>();
      activeSockets.add(client.id);
      this.connectedAdmins.set(payload.sub, activeSockets);
    } catch (error) {
      this.logger.warn(`Rejected admin chat connection: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      return;
    }

    const activeSockets = this.connectedAdmins.get(userId);

    if (!activeSockets) {
      return;
    }

    activeSockets.delete(client.id);

    if (activeSockets.size === 0) {
      this.connectedAdmins.delete(userId);
      return;
    }

    this.connectedAdmins.set(userId, activeSockets);
  }

  broadcastMessage(message: { channel: string }) {
    this.server
      ?.to(this.buildChannelRoom(message.channel as AdminChatChannel))
      .emit('admin_message', message);
  }

  getOnlineAdminIds(): string[] {
    return Array.from(this.connectedAdmins.keys());
  }

  private buildChannelRoom(channel: AdminChatChannel) {
    return `admin-chat:${channel}`;
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth.token as string | undefined;
    const queryToken = client.handshake.query.token as string | undefined;
    const authorizationHeader = client.handshake.headers.authorization;

    if (authToken) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    if (queryToken) {
      return queryToken.replace(/^Bearer\s+/i, '');
    }

    if (typeof authorizationHeader === 'string') {
      return authorizationHeader.replace(/^Bearer\s+/i, '');
    }

    return null;
  }

  private extractAdminPath(client: Socket): string | null {
    const authPath = client.handshake.auth.adminPath as string | undefined;
    const queryPath = client.handshake.query.adminPath as string | undefined;
    const headerPath = client.handshake.headers['x-admin-path'];

    if (authPath) {
      return authPath.trim();
    }

    if (queryPath) {
      return queryPath.trim();
    }

    if (typeof headerPath === 'string') {
      return headerPath.trim();
    }

    return null;
  }
}
