export const RECONCILIATION_SUPPORTED_ASSET = 'USDT' as const;
export const RECONCILIATION_SUPPORTED_NETWORKS = ['TRC20', 'ERC20', 'BEP20'] as const;
export const RECONCILIATION_DEFAULT_INTERVAL_HOURS = 12;
export const RECONCILIATION_DEFAULT_TOLERANCE = 1;
export const RECONCILIATION_DEFAULT_STALE_SNAPSHOT_HOURS = 12;
export const RECONCILIATION_DEFAULT_PENDING_WITHDRAWAL_THRESHOLD = 1_000;
export const RECONCILIATION_DEFAULT_APPROVED_OUTFLOW_THRESHOLD = 1_000;

export const RECONCILIATION_FORMULAS = {
  grossDifference: 'treasuryBalance - internalClientLiabilities',
  operationalDifference:
    'treasuryBalance - internalClientLiabilities - approvedButNotSentWithdrawalsTotal',
} as const;
