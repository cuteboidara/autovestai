import { beforeEach, describe, expect, it } from 'vitest';

import { useOrdersStore } from '@/store/orders-store';
import { usePositionsStore } from '@/store/positions-store';
import { useWalletStore } from '@/store/wallet-store';
import { PositionRecord } from '@/types/trading';
import { WalletSnapshotResponse, WalletTransaction } from '@/types/wallet';

const walletSnapshot = {
  wallet: {
    id: 'wallet-1',
    userId: 'user-1',
    type: 'LIVE',
    name: 'Primary',
    accountNo: '100001',
    balance: 1000,
    balanceAsset: 'USDT',
    currency: 'USDT',
    lockedMargin: 0,
    usedMargin: 0,
    unrealizedPnl: 0,
    equity: 1000,
    freeMargin: 1000,
    marginLevel: null,
    status: 'ACTIVE',
    isDefault: true,
  },
  transactions: [],
} satisfies WalletSnapshotResponse;

const walletTransaction: WalletTransaction = {
  id: 'txn-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  type: 'DEPOSIT',
  amount: 100,
  asset: 'USDT',
  status: 'PENDING',
  reference: null,
  metadata: null,
  createdAt: '2026-04-09T00:00:00.000Z',
  updatedAt: '2026-04-09T00:00:00.000Z',
};

beforeEach(() => {
  useWalletStore.setState({ wallet: null, transactions: [] });
  useOrdersStore.setState({ orders: [] });
  usePositionsStore.setState({ positions: [] });
});

describe('shared store guards', () => {
  it('defaults missing wallet transactions to an empty array', () => {
    useWalletStore
      .getState()
      .setSnapshot({ ...walletSnapshot, transactions: undefined } as unknown as WalletSnapshotResponse);

    expect(useWalletStore.getState().transactions).toEqual([]);
  });

  it('can upsert a wallet transaction after malformed state', () => {
    useWalletStore.setState({ transactions: undefined as unknown as WalletTransaction[] });

    useWalletStore.getState().upsertTransaction(walletTransaction);

    expect(useWalletStore.getState().transactions).toEqual([walletTransaction]);
  });

  it('defaults malformed orders and positions payloads to empty arrays', () => {
    useOrdersStore.getState().setOrders(undefined as never);
    usePositionsStore.getState().setPositions(undefined as never);

    expect(useOrdersStore.getState().orders).toEqual([]);
    expect(usePositionsStore.getState().positions).toEqual([]);
  });

  it('ignores malformed position merges without clobbering existing rows', () => {
    const position: PositionRecord = {
      id: 'position-1',
      userId: 'user-1',
      accountId: 'account-1',
      orderId: 'order-1',
      symbol: 'EURUSD',
      side: 'BUY',
      entryPrice: 1.1,
      exitPrice: null,
      status: 'OPEN',
      volume: 1,
      leverage: 100,
      margin: 10,
      marginUsed: 10,
      liquidationPrice: null,
      pnl: 5,
      currentPrice: 1.1005,
      unrealizedPnl: 5,
      openedAt: '2026-04-09T00:00:00.000Z',
      createdAt: '2026-04-09T00:00:00.000Z',
      updatedAt: '2026-04-09T00:00:00.000Z',
    };

    usePositionsStore.setState({ positions: [position] });
    usePositionsStore.getState().mergePositions(undefined as never);

    expect(usePositionsStore.getState().positions).toEqual([position]);
  });
});
