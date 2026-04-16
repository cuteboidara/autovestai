import {
  BadRequestException,
  Logger,
  OnModuleInit,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';

import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  RealtimeChannelRequestDto,
  RealtimeSubscriptionDto,
} from './dto/realtime-subscription.dto';
import { SUPPORTED_RESOLUTION_MAP } from '../market-data/symbols.config';
import { SymbolsService } from '../symbols/symbols.service';

@WebSocketGateway({
  cors: {
    origin:
      process.env.CORS_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? ['http://localhost:3000', 'http://localhost:3001'],
  },
  namespace: 'realtime',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class TradingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TradingGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly symbolsService: SymbolsService,
  ) {}

  onModuleInit(): void {
    this.logger.log('Realtime gateway initialized');
  }

  async handleConnection(@ConnectedSocket() client: Socket): Promise<void> {
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn(`Rejected realtime connection without token (client ${client.id})`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      client.data.userId = payload.sub;
      client.data.userRole = String(payload.role).toUpperCase();
      client.join(this.buildUserRoom(payload.sub));

      if (client.data.userRole === 'ADMIN') {
        client.join(this.buildAdminRoom());
      }

      this.logger.log(
        `Realtime client connected: client=${client.id} user=${payload.sub} role=${client.data.userRole} totalClients=${this.getConnectedClientCount()}`,
      );
    } catch (error) {
      this.logger.warn(`Rejected realtime connection: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId as string | undefined;

    if (userId) {
      client.leave(this.buildUserRoom(userId));
    }

    if (client.data.userRole === 'ADMIN') {
      client.leave(this.buildAdminRoom());
    }

    this.logger.log(
      `Realtime client disconnected: client=${client.id} user=${userId ?? 'anonymous'} totalClients=${Math.max(
        this.getConnectedClientCount() - 1,
        0,
      )}`,
    );
  }

  buildUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  buildPriceRoom(symbol: string): string {
    return `price:${symbol}`;
  }

  buildAdminRoom(): string {
    return 'admin:ops';
  }

  buildCandleRoom(symbol: string, resolution = '1'): string {
    return `candle:${symbol}:${resolution}`;
  }

  getConnectedClientCount(): number {
    return this.server?.sockets?.sockets?.size ?? 0;
  }

  getRoomClientCount(room: string): number {
    return this.server?.sockets?.adapter?.rooms?.get(room)?.size ?? 0;
  }

  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() payload: RealtimeSubscriptionDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.routeSubscriptionMessage(payload, client);
  }

  @SubscribeMessage('subscribe_price')
  handleSubscribePrice(
    @MessageBody() payload: RealtimeChannelRequestDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.subscribePrice(client, payload.symbol);
  }

  @SubscribeMessage('unsubscribe_price')
  handleUnsubscribePrice(
    @MessageBody() payload: RealtimeChannelRequestDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.unsubscribePrice(client, payload.symbol);
  }

  @SubscribeMessage('subscribe_candles')
  handleSubscribeCandles(
    @MessageBody() payload: RealtimeChannelRequestDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.subscribeCandles(client, payload.symbol, payload.resolution);
  }

  @SubscribeMessage('unsubscribe_candles')
  handleUnsubscribeCandles(
    @MessageBody() payload: RealtimeChannelRequestDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.unsubscribeCandles(client, payload.symbol, payload.resolution);
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

  private routeSubscriptionMessage(
    payload: RealtimeSubscriptionDto,
    client: Socket,
  ) {
    switch (payload.type) {
      case 'subscribe_price':
        return this.subscribePrice(client, payload.symbol);
      case 'unsubscribe_price':
        return this.unsubscribePrice(client, payload.symbol);
      case 'subscribe_candles':
        return this.subscribeCandles(client, payload.symbol, payload.resolution);
      case 'unsubscribe_candles':
        return this.unsubscribeCandles(client, payload.symbol, payload.resolution);
      default:
        throw new BadRequestException(`Unsupported realtime message type: ${payload.type}`);
    }
  }

  private subscribePrice(client: Socket, symbol: string) {
    const normalizedSymbol = this.assertSupportedSymbol(symbol);
    const room = this.buildPriceRoom(normalizedSymbol);
    client.join(room);
    this.logger.debug(
      `Realtime subscribe price: client=${client.id} user=${String(
        client.data.userId ?? 'anonymous',
      )} symbol=${normalizedSymbol} roomClients=${this.getRoomClientCount(room)}`,
    );

    return {
      status: 'subscribed',
      channel: 'price',
      symbol: normalizedSymbol,
    };
  }

  private unsubscribePrice(client: Socket, symbol: string) {
    const normalizedSymbol = this.assertSupportedSymbol(symbol);
    const room = this.buildPriceRoom(normalizedSymbol);
    client.leave(room);
    this.logger.debug(
      `Realtime unsubscribe price: client=${client.id} user=${String(
        client.data.userId ?? 'anonymous',
      )} symbol=${normalizedSymbol} roomClients=${Math.max(
        this.getRoomClientCount(room) - 1,
        0,
      )}`,
    );

    return {
      status: 'unsubscribed',
      channel: 'price',
      symbol: normalizedSymbol,
    };
  }

  private subscribeCandles(client: Socket, symbol: string, resolution?: string) {
    const normalizedSymbol = this.assertSupportedSymbol(symbol);
    const normalizedResolution = this.normalizeResolution(resolution);
    const room = this.buildCandleRoom(normalizedSymbol, normalizedResolution);
    client.join(room);
    this.logger.debug(
      `Realtime subscribe candles: client=${client.id} user=${String(
        client.data.userId ?? 'anonymous',
      )} symbol=${normalizedSymbol} resolution=${normalizedResolution} roomClients=${this.getRoomClientCount(room)}`,
    );

    return {
      status: 'subscribed',
      channel: 'candles',
      symbol: normalizedSymbol,
      resolution: normalizedResolution,
    };
  }

  private unsubscribeCandles(client: Socket, symbol: string, resolution?: string) {
    const normalizedSymbol = this.assertSupportedSymbol(symbol);
    const normalizedResolution = this.normalizeResolution(resolution);
    const room = this.buildCandleRoom(normalizedSymbol, normalizedResolution);
    client.leave(room);
    this.logger.debug(
      `Realtime unsubscribe candles: client=${client.id} user=${String(
        client.data.userId ?? 'anonymous',
      )} symbol=${normalizedSymbol} resolution=${normalizedResolution} roomClients=${Math.max(
        this.getRoomClientCount(room) - 1,
        0,
      )}`,
    );

    return {
      status: 'unsubscribed',
      channel: 'candles',
      symbol: normalizedSymbol,
      resolution: normalizedResolution,
    };
  }

  private assertSupportedSymbol(symbol: string): string {
    return this.symbolsService.getSymbolOrThrow(symbol).symbol;
  }

  private normalizeResolution(resolution?: string): string {
    if (!resolution) {
      return '1';
    }

    const normalized = resolution.toLowerCase() as keyof typeof SUPPORTED_RESOLUTION_MAP;
    const mapped = SUPPORTED_RESOLUTION_MAP[normalized];

    if (!mapped) {
      throw new BadRequestException(`Unsupported resolution: ${resolution}`);
    }

    return String(mapped);
  }
}
