import { beforeEach, describe, expect, it, vi } from 'vitest';

const { ioMock } = vi.hoisted(() => ({
  ioMock: vi.fn(),
}));

vi.mock('socket.io-client', () => ({
  io: ioMock,
}));

describe('socketManager', () => {
  beforeEach(() => {
    vi.resetModules();
    ioMock.mockReset();
  });

  it('replays active subscriptions on connect and reconnect without pre-connect duplicate emits', async () => {
    const handlers = new Map<string, (payload?: unknown) => void>();
    const mockSocket = {
      auth: {},
      connected: false,
      active: false,
      on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        handlers.set(event, handler);
        return mockSocket;
      }),
      emit: vi.fn(),
      connect: vi.fn(() => {
        mockSocket.active = true;
      }),
      disconnect: vi.fn(),
    };

    ioMock.mockReturnValue(mockSocket);

    const { socketManager } = await import('@/lib/socket-manager');
    const connectionStates: string[] = [];
    socketManager.on('connection_state', (state) => {
      connectionStates.push(String(state));
    });

    socketManager.connect('token-1');
    socketManager.subscribePrice('eurusd');

    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(connectionStates.at(-1)).toBe('reconnecting');

    mockSocket.connected = true;
    handlers.get('connect')?.();

    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_price', {
      symbol: 'EURUSD',
    });
    expect(connectionStates.at(-1)).toBe('connected');

    mockSocket.emit.mockClear();
    mockSocket.connected = false;
    handlers.get('disconnect')?.('transport close');

    expect(connectionStates.at(-1)).toBe('reconnecting');

    mockSocket.connected = true;
    handlers.get('connect')?.();

    expect(mockSocket.emit).toHaveBeenCalledTimes(1);
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe_price', {
      symbol: 'EURUSD',
    });

    socketManager.disconnect();

    expect(connectionStates.at(-1)).toBe('disconnected');
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });
});
