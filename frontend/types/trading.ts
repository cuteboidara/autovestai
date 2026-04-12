export type OrderType = 'MARKET' | 'LIMIT';
export type OrderSide = 'BUY' | 'SELL';
export type OrderStatus =
  | 'PENDING'
  | 'OPEN'
  | 'PROCESSING'
  | 'EXECUTED'
  | 'REJECTED'
  | 'CANCELLED';

export interface PlaceOrderRequest {
  accountId?: string;
  clientRequestId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  volume: number;
  leverage: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  accountId: string;
  type: OrderType;
  side: OrderSide;
  symbol: string;
  volume: number;
  leverage: number;
  requestedPrice: number | null;
  executionPrice: number | null;
  sourceType: 'MANUAL' | 'COPY';
  metadata?: Record<string, unknown> | null;
  status: OrderStatus;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PositionRecord {
  id: string;
  userId: string;
  accountId: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number | null;
  volume: number;
  contractSize?: number | null;
  leverage: number;
  margin: number;
  marginUsed: number;
  liquidationPrice: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  pnl: number;
  currentPrice: number | null;
  currentBid?: number;
  currentAsk?: number;
  unrealizedPnl?: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
