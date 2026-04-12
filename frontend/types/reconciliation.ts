import { TreasuryBalanceSnapshot } from './treasury';

export type ReconciliationRunStatus = 'OK' | 'WARNING' | 'ERROR';
export type ReconciliationRunSource =
  | 'MANUAL'
  | 'SCHEDULED'
  | 'ON_DEMAND'
  | 'SYSTEM';

export interface ReconciliationWarningItem {
  code: string;
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
}

export interface ReconciliationFormulaSet {
  grossDifference: string;
  operationalDifference: string;
}

export interface ReconciliationRun {
  id: string;
  asset: string;
  network: string;
  treasuryWalletAddress: string | null;
  latestTreasuryBalanceSnapshotId: string | null;
  latestTreasuryBalanceSnapshot: TreasuryBalanceSnapshot | null;
  treasuryBalance: number | null;
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  grossDifference: number | null;
  operationalDifference: number | null;
  toleranceUsed: number;
  status: ReconciliationRunStatus;
  warnings: ReconciliationWarningItem[];
  warningCount: number;
  source: ReconciliationRunSource;
  initiatedByUserId: string | null;
  initiatedByUser: {
    id: string;
    email: string;
  } | null;
  formulas: ReconciliationFormulaSet;
  createdAt: string;
}
