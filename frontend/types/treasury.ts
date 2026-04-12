export type TreasuryMonitoringMode = 'manual' | 'api';
export type TreasuryReconciliationStatus = 'ok' | 'warning' | 'error';
export type TreasuryBalanceSnapshotSource = 'manual' | 'api';

export interface TreasuryWarningItem {
  code: string;
  severity: 'warning' | 'error';
  message: string;
}

export interface TreasuryBalanceSnapshot {
  id: string;
  asset: string;
  network: string;
  walletAddress: string;
  balance: number;
  source: TreasuryBalanceSnapshotSource;
  sourceReference: string | null;
  observedAt: string;
  createdByUserId: string | null;
  createdAt: string;
  createdByUser: {
    id: string;
    email: string;
  } | null;
}

export interface TreasurySummary {
  walletAddress: string | null;
  asset: string;
  network: string;
  explorerBaseUrl: string | null;
  explorerUrl: string | null;
  monitoringMode: TreasuryMonitoringMode;
  onChainBalance: number | null;
  liveBalanceAvailable: boolean;
  balanceSource: TreasuryBalanceSnapshotSource | null;
  latestBalanceSnapshot: TreasuryBalanceSnapshot | null;
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  grossTreasuryAfterPendingWithdrawals: number | null;
  netTreasuryAfterPendingOutflows: number | null;
  availableOperatingSurplusDeficit: number | null;
  reconciliationDifference: number | null;
  lastCheckedAt: string | null;
  reconciliationStatus: TreasuryReconciliationStatus;
  warnings: TreasuryWarningItem[];
}

export interface TreasuryMovement {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  userId: string;
  userEmail: string | null;
  amount: number;
  asset: string;
  network: string | null;
  status: string;
  txHash: string | null;
  explorerUrl: string | null;
  source: string;
  reference: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryReconciliationReport {
  latestOnChainBalanceSnapshot: TreasuryBalanceSnapshot | null;
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  reconciliationDifference: number | null;
  status: TreasuryReconciliationStatus;
  warnings: TreasuryWarningItem[];
  generatedAt: string;
}

export interface TreasuryLiabilitiesBreakdownUser {
  userId: string;
  email: string;
  balance: number;
  concentrationPercentage: number;
}

export interface TreasuryLiabilitiesBreakdown {
  totalLiabilities: number;
  totalActiveUsersWithBalance: number;
  concentrationPercentageTop5: number;
  topUsers: TreasuryLiabilitiesBreakdownUser[];
}
