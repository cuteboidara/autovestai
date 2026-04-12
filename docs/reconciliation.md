# Reconciliation Engine

AutovestAI reconciliation compares two different layers:

- internal wallet ledger liabilities, which remain the source of truth for what users are owed
- treasury balance observations, which represent observed custody in the alpha treasury wallet

## Formulas

- Gross difference: `treasuryBalance - internalClientLiabilities`
- Operational difference: `treasuryBalance - internalClientLiabilities - approvedButNotSentWithdrawalsTotal`

Gross difference answers whether observed treasury and user liabilities match.
Operational difference answers whether approved but not yet sent withdrawals would push treasury into an operational deficit.

## Status Logic

- `OK`: difference is within tolerance, snapshot is fresh enough, and no elevated outflow warnings are active
- `WARNING`: mismatch above tolerance, stale snapshot, or elevated pending withdrawal risk
- `ERROR`: treasury config missing, snapshot missing, liabilities exceed treasury, unsupported asset/network, or approved unsent withdrawals create an operational deficit

## Manual Balance Snapshots

Treasury balance snapshots are a custody observation layer.
They do not replace internal wallet balances.

If live treasury monitoring is unavailable, owner/admin can record manual snapshots from the treasury dashboard.
Reconciliation runs use the latest available snapshot or live-observed balance.

## Daily Alpha Ops Flow

1. Record a fresh treasury balance snapshot if live monitoring is unavailable.
2. Review the treasury dashboard for pending deposits, pending withdrawals, and approved-not-sent withdrawals.
3. Run reconciliation from the admin reconciliation console.
4. Investigate any `WARNING` or `ERROR` status before approving further treasury outflows.

## Alpha Limitations

- USDT only
- single treasury wallet
- one active network at a time
- wallet movements are manually approved
- reconciliation depends on observed treasury balance quality and freshness
