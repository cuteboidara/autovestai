export type ProviderSortBy =
  | 'BEST_RETURN'
  | 'MOST_COPIERS'
  | 'LOWEST_DRAWDOWN'
  | 'NEWEST';

export type CopyRelationStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED';

export interface ProviderMonthlyReturnPoint {
  label: string;
  month: string;
  value: number;
}

export interface ProviderEquityCurvePoint {
  timestamp: string;
  label: string;
  value: number;
}

export interface SignalProviderSummary {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  strategy?: string | null;
  accountId: string;
  totalReturn: number;
  monthlyReturn: number;
  winRate: number;
  maxDrawdown: number;
  totalTrades: number;
  activeCopiers: number;
  minCopyAmount: number;
  feePercent: number;
  isPublic: boolean;
  isAccepting: boolean;
  createdAt: string;
  updatedAt: string;
  account: {
    id: string;
    name: string;
    type: 'LIVE' | 'DEMO';
    currency: string;
    balance: number;
    equity: number;
    isDefault: boolean;
  };
  monthlyReturns: ProviderMonthlyReturnPoint[];
}

export interface SignalProviderProfile extends SignalProviderSummary {
  stats: {
    totalReturn: number;
    monthlyReturn: number;
    winRate: number;
    maxDrawdown: number;
    totalTrades: number;
    activeCopiers: number;
    avgTradeDurationHours: number;
    profitableTrades: number;
    totalClosedPnl: number;
    currentBalance: number;
    currentEquity: number;
  };
  equityCurve: ProviderEquityCurvePoint[];
  recentTrades: Array<{
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    openedAt: string;
    closedAt: string | null;
    pnl: number;
    pnlPercent: number;
    volume: number;
    durationHours: number;
  }>;
  currentCopiers: Array<{
    id: string;
    alias: string;
    status: CopyRelationStatus;
    allocatedAmount: number;
    copyRatio: number;
    totalCopiedPnl: number;
    feesPaid: number;
    startedAt: string;
    stoppedAt: string | null;
    account: {
      id: string;
      name: string;
      type: 'LIVE' | 'DEMO';
    };
  }>;
}

export interface CopyRelationRecord {
  id: string;
  copierId: string;
  copyAccountId: string;
  providerId: string;
  allocatedAmount: number;
  copyRatio: number;
  status: CopyRelationStatus;
  totalCopiedPnl: number;
  feesPaid: number;
  netCopiedPnl: number;
  startedAt: string;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
  provider: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    strategy?: string | null;
    totalReturn: number;
    monthlyReturn: number;
    winRate: number;
    maxDrawdown: number;
    activeCopiers: number;
    minCopyAmount: number;
    feePercent: number;
    isAccepting: boolean;
  };
  copyAccount: {
    id: string;
    name: string;
    type: 'LIVE' | 'DEMO';
    currency: string;
    balance: number;
    equity: number;
    isDefault: boolean;
  };
}

export interface RegisterSignalProviderPayload {
  accountId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  strategy?: string;
  minCopyAmount: number;
  feePercent: number;
  isPublic?: boolean;
  isAccepting?: boolean;
}

export interface UpdateSignalProviderPayload
  extends Partial<RegisterSignalProviderPayload> {}

export interface StartCopyPayload {
  copyAccountId: string;
  allocatedAmount: number;
  copyRatio?: number;
  status?: CopyRelationStatus;
}

export interface UpdateCopyRelationPayload {
  allocatedAmount?: number;
  copyRatio?: number;
  status?: CopyRelationStatus;
}

export interface ListProvidersParams {
  sortBy?: ProviderSortBy;
  minReturn?: number;
  maxDrawdown?: number;
}

// Legacy copy-trading interfaces retained for older admin/client surfaces that
// still import them, even though the new marketplace is built on SignalProvider.
export interface CopyMaster {
  id: string;
  userId: string;
  displayName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  performanceFeePercent: string | number;
  minFollowerBalance: string | number;
  followerCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CopyFollower {
  id: string;
  masterId: string;
  followerUserId: string;
  allocationType: 'FIXED' | 'BALANCE_RATIO' | 'EQUITY_RATIO';
  allocationValue: string | number;
  maxAllocation: string | number;
  maxOpenTrades: number;
  slippageTolerance: string | number;
  symbolWhitelist: string[];
  symbolBlacklist: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  master?: CopyMaster;
}

export interface CopyTrade {
  id: string;
  masterPositionId: string;
  followerPositionId?: string | null;
  masterId: string;
  followerUserId: string;
  status: 'OPEN' | 'CLOSED' | 'FAILED' | 'SKIPPED';
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CopyMasterStats {
  totalFollowers: number;
  winRate: number;
  totalPnl: number;
  averageReturn: number;
  maxDrawdown: number;
  numberOfTrades: number;
  activeAumEstimate: number;
}
