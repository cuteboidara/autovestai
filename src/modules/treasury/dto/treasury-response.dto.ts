export type TreasuryMonitoringMode = 'manual' | 'api';
export type TreasuryReconciliationStatus = 'ok' | 'warning' | 'error';
export type TreasuryWarningSeverity = 'warning' | 'error';
export type TreasuryBalanceSnapshotSource = 'manual' | 'api';

export interface TreasuryWarningItemDto {
  code: string;
  severity: TreasuryWarningSeverity;
  message: string;
}

export interface TreasuryBalanceSnapshotDto {
  id: string;
  asset: string;
  network: string;
  walletAddress: string;
  balance: number;
  source: TreasuryBalanceSnapshotSource;
  sourceReference: string | null;
  observedAt: Date;
  createdByUserId: string | null;
  createdAt: Date;
  createdByUser: {
    id: string;
    email: string;
  } | null;
}

export interface TreasurySummaryDto {
  walletAddress: string | null;
  asset: string;
  network: string;
  explorerBaseUrl: string | null;
  explorerUrl: string | null;
  monitoringMode: TreasuryMonitoringMode;
  onChainBalance: number | null;
  liveBalanceAvailable: boolean;
  balanceSource: TreasuryBalanceSnapshotSource | null;
  latestBalanceSnapshot: TreasuryBalanceSnapshotDto | null;
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  grossTreasuryAfterPendingWithdrawals: number | null;
  netTreasuryAfterPendingOutflows: number | null;
  availableOperatingSurplusDeficit: number | null;
  reconciliationDifference: number | null;
  lastCheckedAt: Date | null;
  reconciliationStatus: TreasuryReconciliationStatus;
  warnings: TreasuryWarningItemDto[];
}

export interface TreasuryMovementDto {
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
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreasuryReconciliationReportDto {
  latestOnChainBalanceSnapshot: TreasuryBalanceSnapshotDto | null;
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  reconciliationDifference: number | null;
  status: TreasuryReconciliationStatus;
  warnings: TreasuryWarningItemDto[];
  generatedAt: Date;
}

export interface TreasuryLiabilitiesBreakdownUserDto {
  userId: string;
  email: string;
  balance: number;
  concentrationPercentage: number;
}

export interface TreasuryLiabilitiesBreakdownDto {
  totalLiabilities: number;
  totalActiveUsersWithBalance: number;
  concentrationPercentageTop5: number;
  topUsers: TreasuryLiabilitiesBreakdownUserDto[];
}
