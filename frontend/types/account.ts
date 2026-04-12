export interface AccountSummary {
  id: string;
  userId: string;
  type: 'LIVE' | 'DEMO';
  name: string;
  accountNo: string;
  balance: number;
  balanceAsset: string;
  currency: string;
  usedMargin: number;
  lockedMargin: number;
  unrealizedPnl: number;
  equity: number;
  freeMargin: number;
  marginLevel: number | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  isDefault: boolean;
  openPositions: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountRequest {
  type: 'LIVE' | 'DEMO';
  name?: string;
}

export interface AccountActionResult {
  success: boolean;
}
