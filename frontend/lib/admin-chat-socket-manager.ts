'use client';

import { io, Socket } from 'socket.io-client';

import { env } from './env';

type EventHandler = (payload: unknown) => void;

class AdminChatSocketManager {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();

  connect(token: string | null) {
    if (this.socket) {
      this.socket.auth = token
        ? { token: `Bearer ${token}`, adminPath: env.adminPath }
        : { adminPath: env.adminPath };

      if (!this.socket.connected && !this.socket.active) {
        this.socket.connect();
      }

      return this.socket;
    }

    this.socket = io(`${env.wsUrl}/admin-chat`, {
      transports: ['websocket'],
      auth: token
        ? { token: `Bearer ${token}`, adminPath: env.adminPath }
        : { adminPath: env.adminPath },
      autoConnect: true,
      reconnection: true,
    });

    for (const event of ['connect', 'disconnect', 'admin_message']) {
      this.socket.on(event, (payload) => {
        this.handlers.get(event)?.forEach((handler) => handler(payload));
      });
    }

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: 'connect' | 'disconnect' | 'admin_message', handler: EventHandler) {
    const bucket = this.handlers.get(event) ?? new Set<EventHandler>();
    bucket.add(handler);
    this.handlers.set(event, bucket);

    return () => {
      bucket.delete(handler);
    };
  }
}

export const adminChatSocketManager = new AdminChatSocketManager();
