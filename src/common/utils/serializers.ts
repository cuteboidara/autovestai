import { Account, Order, Position, TradeExecution, Transaction, User, Wallet } from '@prisma/client';

import { Candle } from '../interfaces/candle.interface';
import { PriceSnapshot } from '../interfaces/price-snapshot.interface';
import { toNumber } from './decimal';

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function serializeWallet(
  wallet: Wallet,
  metrics: {
    unrealizedPnl: number;
    equity: number;
    freeMargin: number;
    marginLevel?: number | null;
  },
) {
  return {
    id: wallet.id,
    userId: wallet.userId,
    balance: toNumber(wallet.balance),
    balanceAsset: 'USDT' as const,
    lockedMargin: toNumber(wallet.lockedMargin),
    usedMargin: toNumber(wallet.lockedMargin),
    unrealizedPnl: metrics.unrealizedPnl,
    equity: metrics.equity,
    freeMargin: metrics.freeMargin,
    marginLevel: metrics.marginLevel ?? null,
    createdAt: wallet.createdAt,
    updatedAt: wallet.updatedAt,
  };
}

export function serializeAccount(
  account: Account,
  metrics: {
    unrealizedPnl: number;
    equity: number;
    freeMargin: number;
    usedMargin: number;
    marginLevel?: number | null;
    openPositions?: number;
  },
) {
  return {
    id: account.id,
    userId: account.userId,
    type: account.type,
    name: account.name,
    accountNo: account.accountNo,
    balance: toNumber(account.balance),
    balanceAsset: account.currency,
    currency: account.currency,
    usedMargin: metrics.usedMargin,
    lockedMargin: metrics.usedMargin,
    unrealizedPnl: metrics.unrealizedPnl,
    equity: metrics.equity,
    freeMargin: metrics.freeMargin,
    marginLevel: metrics.marginLevel ?? null,
    status: account.status,
    isDefault: account.isDefault,
    openPositions: metrics.openPositions ?? 0,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export function serializeAccountAsWallet(
  account: Account,
  metrics: {
    unrealizedPnl: number;
    equity: number;
    freeMargin: number;
    usedMargin: number;
    marginLevel?: number | null;
  },
) {
  return {
    ...serializeAccount(account, {
      ...metrics,
      openPositions: undefined,
    }),
    walletId: account.id,
  };
}

export function serializeTransaction(transaction: Transaction) {
  return {
    id: transaction.id,
    userId: transaction.userId,
    walletId: transaction.walletId,
    accountId: transaction.accountId,
    type: transaction.type,
    amount: toNumber(transaction.amount),
    asset: transaction.asset,
    status: transaction.status,
    reference: transaction.reference,
    metadata: transaction.metadata,
    approvedById: transaction.approvedById,
    approvedAt: transaction.approvedAt,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export function serializeOrder(order: Order) {
  return {
    id: order.id,
    userId: order.userId,
    accountId: order.accountId,
    type: order.type,
    side: order.side,
    symbol: order.symbol,
    volume: toNumber(order.volume),
    leverage: order.leverage,
    requestedPrice: toNumber(order.requestedPrice),
    executionPrice: toNumber(order.executionPrice),
    sourceType: order.sourceType,
    metadata: order.metadata,
    status: order.status,
    rejectionReason: order.rejectionReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function serializePosition(position: Position, currentPrice?: number) {
  return {
    id: position.id,
    userId: position.userId,
    accountId: position.accountId,
    orderId: position.orderId,
    copiedFromTradeId: position.copiedFromTradeId,
    symbol: position.symbol,
    side: position.side,
    entryPrice: toNumber(position.entryPrice),
    exitPrice: toNumber(position.exitPrice),
    volume: toNumber(position.volume),
    contractSize: toNumber(position.contractSize),
    leverage: position.leverage,
    margin: toNumber(position.margin),
    marginUsed: toNumber(position.marginUsed),
    liquidationPrice: toNumber(position.liquidationPrice),
    pnl: toNumber(position.pnl),
    currentPrice: currentPrice ?? null,
    status: position.status,
    openedAt: position.openedAt,
    closedAt: position.closedAt,
    createdAt: position.createdAt,
    updatedAt: position.updatedAt,
  };
}

export function serializeTradeExecution(execution: TradeExecution) {
  return {
    id: execution.id,
    userId: execution.userId,
    orderId: execution.orderId,
    symbol: execution.symbol,
    side: execution.side,
    volume: toNumber(execution.volume),
    price: toNumber(execution.price),
    realizedPnl: toNumber(execution.realizedPnl),
    metadata: execution.metadata,
    createdAt: execution.createdAt,
  };
}

export function serializePriceSnapshot(snapshot: PriceSnapshot) {
  return {
    symbol: snapshot.symbol,
    rawPrice: snapshot.rawPrice,
    lastPrice: snapshot.lastPrice,
    bid: snapshot.bid,
    ask: snapshot.ask,
    spread: snapshot.spread,
    markup: snapshot.markup,
    source: snapshot.source,
    marketState: snapshot.marketState,
    marketStatus: snapshot.marketState,
    changePct: snapshot.changePct ?? null,
    dayHigh: snapshot.dayHigh ?? null,
    dayLow: snapshot.dayLow ?? null,
    delayed: snapshot.delayed ?? false,
    timestamp: snapshot.timestamp,
    lastUpdated: snapshot.lastUpdated,
  };
}

export function serializeCandle(candle: Candle) {
  return {
    symbol: candle.symbol,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    timestamp: candle.timestamp,
  };
}
