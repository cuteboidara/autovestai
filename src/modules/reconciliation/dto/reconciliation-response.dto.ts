import { TreasuryBalanceSnapshotDto } from '../../treasury/dto/treasury-response.dto';

export type ReconciliationRunStatusDto = 'OK' | 'WARNING' | 'ERROR';
export type ReconciliationRunSourceDto =
  | 'MANUAL'
  | 'SCHEDULED'
  | 'ON_DEMAND'
  | 'SYSTEM';
export type ReconciliationWarningSeverityDto = 'warning' | 'critical';

export interface ReconciliationWarningItemDto {
  code: string;
  severity: ReconciliationWarningSeverityDto;
  title: string;
  detail: string;
}

export interface ReconciliationFormulaSetDto {
  grossDifference: string;
  operationalDifference: string;
}

export interface ReconciliationRunDto {
  id: string;
  asset: string;
  network: string;
  treasuryWalletAddress: string | null;
  latestTreasuryBalanceSnapshotId: string | null;
  latestTreasuryBalanceSnapshot: TreasuryBalanceSnapshotDto | null;
  treasuryBalance: number | null;
  internalClientLiabilities: number;
  pendingDepositsTotal: number;
  pendingWithdrawalsTotal: number;
  approvedButNotSentWithdrawalsTotal: number;
  grossDifference: number | null;
  operationalDifference: number | null;
  toleranceUsed: number;
  status: ReconciliationRunStatusDto;
  warnings: ReconciliationWarningItemDto[];
  warningCount: number;
  source: ReconciliationRunSourceDto;
  initiatedByUserId: string | null;
  initiatedByUser: {
    id: string;
    email: string;
  } | null;
  formulas: ReconciliationFormulaSetDto;
  createdAt: Date;
}

export interface ReconciliationHealthSnapshotDto {
  latestStatus: ReconciliationRunStatusDto | null;
  latestRunTimestamp: string | null;
  warningCount: number;
  errorState: boolean;
}
