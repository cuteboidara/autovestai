import { AccountSummary } from './account';
import { AffiliateCommission } from './affiliates';
import { AdminUserRole } from './auth';
import { KycSubmission } from './kyc';
import { OrderRecord, PositionRecord } from './trading';
import { WalletSummary, WalletTransaction } from './wallet';
import { PlatformSymbolHealth } from './platform';

export interface AdminSessionView {
  id: string;
  deviceFingerprintMasked: string;
  ipAddressMasked?: string | null;
  userAgent?: string | null;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
}

export interface AdminExposure {
  symbol: string;
  longVolume: number;
  shortVolume: number;
  netVolume: number;
  weightedAvgLongPrice: number | null;
  weightedAvgShortPrice: number | null;
  floatingPnlImpactEstimate: number;
  topClients: Array<{
    userId: string;
    email: string;
    volume: number;
  }>;
  timestamp?: string;
}

export interface HedgeAction {
  id: string;
  symbol: string;
  actionType: 'HEDGE_BUY' | 'HEDGE_SELL' | 'REDUCE' | 'CLOSE';
  volume: string | number;
  reason: string;
  status: 'SUGGESTED' | 'APPROVED' | 'SENT' | 'FAILED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface FailedQueueJobRecord {
  id: string;
  name: string;
  data: Record<string, unknown>;
  attemptsMade: number;
  failedReason: string | null;
  stacktrace: string[];
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
}

export interface AdminOverview {
  totalUsers: number;
  activeUsers: number;
  totalBalances: number;
  openPositions: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingKyc: number;
  exposure: AdminExposure[];
  hedgeActions: HedgeAction[];
  copyTrading: {
    masters: number;
    followers: number;
    trades: number;
  };
  affiliateCommissions: Array<{
    status: AffiliateCommission['status'];
    _sum: {
      commissionAmount: string | number | null;
    };
  }>;
  treasury: {
    masterWalletTrc20: string | null;
    masterWalletErc20: string | null;
    pendingWithdrawalAmount: number;
  };
}

export interface AdminUserListItem {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  kycStatus: string;
  walletBalance: number;
  openPositions: number;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MIXED' | 'NONE';
  totalAccounts: number;
  affiliateStatus: string | null;
  signalProviderStatus: string | null;
  createdAt: string;
}

export interface AdminCopyProvider {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  strategy?: string | null;
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
  status: 'ACTIVE' | 'PAUSED' | 'HIDDEN';
  followerCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
  };
  account: {
    id: string;
    name: string;
    accountNo: string;
    type: 'LIVE' | 'DEMO';
    status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    balance: number;
    equity: number;
  };
}

export interface AdminCopyTrade {
  id: string;
  masterId: string | null;
  masterPositionId: string | null;
  followerUserId: string;
  followerPositionId: string | null;
  status: 'OPEN' | 'CLOSED';
  reason?: string | null;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  pnl: number;
  createdAt: string;
  updatedAt: string;
  openedAt: string;
  closedAt?: string | null;
  master?: {
    id: string;
    displayName: string;
    accountNo?: string;
  } | null;
  follower: {
    id: string;
    email: string;
  };
  account: {
    id: string;
    name: string;
    accountNo: string;
    type: 'LIVE' | 'DEMO';
  };
}

export interface AdminUserDetail {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  wallet: WalletSummary | null;
  accounts: AccountSummary[];
  positions: PositionRecord[];
  orders: OrderRecord[];
  transactions: WalletTransaction[];
  affiliate: {
    id: string;
    referralCode: string;
    status: string;
    level: number;
  } | null;
  signalProvider: {
    id: string;
    displayName: string;
    status: string;
    isPublic: boolean;
    isAccepting: boolean;
    accountId: string;
  } | null;
  sessions?: AdminSessionView[];
  kycSubmission: KycSubmission | null;
  createdAt: string;
}

export interface ManagedAdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: AdminUserRole;
  status: 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
  lastLoginAt: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  isSeededSuperAdmin: boolean;
  permissions?: string[];
  createdBy?: {
    id: string;
    email: string;
    fullName: string;
  } | null;
}

export interface CreateManagedAdminResponse {
  admin: ManagedAdminUser;
  temporaryPassword: string;
  welcomeEmailSent: boolean;
  welcomeEmailSkipped: boolean;
}

export interface AdminDepositAddressRecord {
  id: string;
  userId: string;
  network: string;
  address: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
  };
}

export interface AdminIncomingWalletTransaction extends WalletTransaction {
  user: {
    id: string;
    email: string;
  };
}

export interface AdminWithdrawalRecord {
  id: string;
  userId: string;
  accountId: string;
  amount: number;
  fee: number;
  netAmount: number;
  network: 'TRC20' | 'ERC20';
  toAddress: string;
  status: 'PENDING' | 'APPROVED' | 'SENT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  adminNote?: string | null;
  txHash?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    accountNumber: string;
  };
  account: {
    id: string;
    accountNo: string;
    name: string;
    type: 'LIVE' | 'DEMO';
  };
}

export interface BrokerSettingsResponse {
  features: {
    tradingEnabled: boolean;
    registrationsEnabled: boolean;
    withdrawalsEnabled: boolean;
    copyTradingEnabled: boolean;
    affiliateProgramEnabled: boolean;
    affiliatePayoutsEnabled: boolean;
    maintenanceModeEnabled: boolean;
    maintenanceMessage: string;
  };
  affiliateLevels: {
    level1Percent: number;
    level2Percent: number;
    level3Percent: number;
  };
  treasury: {
    masterWalletTrc20: string | null;
    masterWalletErc20: string | null;
  };
}

export interface SymbolConfigRecord {
  symbol: string;
  maxLeverage: number;
  spreadMarkup: number;
  tradingEnabled: boolean;
  maxExposureThreshold: number;
  isActive?: boolean;
}

export interface AdminSymbolRecord {
  symbol: string;
  displayName: string;
  description: string;
  assetClass: 'FOREX' | 'METALS' | 'INDICES' | 'COMMODITIES' | 'CRYPTO' | 'STOCKS' | 'ETFS';
  category: 'FOREX' | 'METALS' | 'INDICES' | 'COMMODITIES' | 'CRYPTO' | 'STOCKS' | 'ETFS';
  marketGroup?: string | null;
  lotSize: number;
  marginRetailPct: number;
  marginProPct: number;
  swapLong: number;
  swapShort: number;
  digits: number;
  minTickIncrement: number;
  minTradeSizeLots: number;
  maxTradeSizeLots: number;
  pipValue: string;
  tradingHours: string;
  defaultSpread: number;
  quoteSource: string;
  quoteSymbol?: string | null;
  enabled: boolean;
  isActive: boolean;
  tradingViewSymbol: string;
  tickSize: number;
  minLot: number;
  maxLot: number;
  priceScale: number;
  session: string;
  type: string;
  maxLeverage: number;
  spreadMarkup: number;
  tradingEnabled: boolean;
  maxExposureThreshold: number;
  bid: number | null;
  ask: number | null;
  lastPrice: number | null;
  marketState: string;
  quoteTimestamp: string | null;
  healthStatus: string;
  healthReason: string;
  tradingAvailable: boolean;
}

export interface PricingProviderHealth {
  provider: string;
  transport: 'streaming' | 'polling';
  status: 'connecting' | 'connected' | 'polling' | 'degraded' | 'disconnected';
  symbolCount: number;
  lastUpdateAt: string | null;
  lastError: string | null;
}

export interface PricingSampleQuote {
  symbol: string;
  lastPrice: number | null;
  lastUpdated: string | null;
  provider: string | null;
  marketState: string | null;
  delayed: boolean;
}

export interface OperationalMetrics {
  openPositions: number;
  pendingWithdrawals: number;
  queueBacklog: {
    orderExecution: number;
    copyTrading: number;
  };
  failedJobs: {
    orderExecution: number;
    copyTrading: number;
  };
  websocketConnectedClients: number;
  surveillanceAlertCounts: Record<string, number>;
  symbolHealth: Record<string, PlatformSymbolHealth>;
  providerHealth: Record<string, PricingProviderHealth>;
  sampleQuotes: PricingSampleQuote[];
  reconciliation?: {
    latestStatus: 'OK' | 'WARNING' | 'ERROR' | null;
    latestRunTimestamp: string | null;
    warningCount: number;
    errorState: boolean;
  };
}

export interface AdminOpenPosition {
  id: string;
  userId: string;
  email: string;
  accountId: string;
  accountName: string;
  accountNo: string;
  accountType: 'LIVE' | 'DEMO';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  entryPrice: number;
  pnl: number;
  openedAt: string;
  copiedFromTradeId?: string | null;
}

export interface AdminOrderRecord {
  id: string;
  userId: string;
  email: string;
  accountId: string;
  accountName: string;
  accountNo: string;
  accountType: 'LIVE' | 'DEMO';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  status: 'PENDING' | 'OPEN' | 'PROCESSING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
  volume: number;
  requestedPrice: number | null;
  executionPrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessChecklistItem {
  key: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | 'degraded';
  detail: unknown;
}

export interface AuditLogRecord {
  id: string;
  actorUserId?: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  targetUserId?: string | null;
  metadataJson?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  createdAt: string;
  actorUser?: {
    id: string;
    email: string;
  } | null;
  targetUser?: {
    id: string;
    email: string;
  } | null;
}

export interface SurveillanceAlert {
  id: string;
  userId?: string | null;
  symbol?: string | null;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';
  title: string;
  description: string;
  metadataJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
  } | null;
  acknowledgedByUser?: {
    id: string;
    email: string;
  } | null;
  closedByUser?: {
    id: string;
    email: string;
  } | null;
}

export interface SurveillanceCase {
  id: string;
  userId?: string | null;
  alertId?: string | null;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
  assignedToUserId?: string | null;
  notesJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
  } | null;
  assignedToUser?: {
    id: string;
    email: string;
  } | null;
  alert?: SurveillanceAlert | null;
}
