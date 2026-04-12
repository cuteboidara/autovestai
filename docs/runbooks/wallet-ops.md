# Wallet Ops Runbook

## Deposit Review

1. Open pending deposit queue.
2. Verify request details:
   - asset,
   - network,
   - amount,
   - reference / proof.
3. Verify off-platform treasury evidence manually.
4. Approve or reject with a reason.
5. Confirm:
   - audit log exists,
   - user wallet updated if approved,
   - support note recorded if rejected.

## Withdrawal Review

1. Confirm withdrawals are enabled.
2. Open pending withdrawal queue.
3. Verify:
   - KYC approved,
   - address format and network,
   - amount,
   - recent deposit/withdrawal behavior,
   - surveillance alerts,
   - unusual affiliate/copy-trading context if relevant.
4. If suspicious, reject and escalate to surveillance/compliance.
5. If approving:
   - record external payout reference outside the platform if the product team has not yet added explicit tx-hash fields,
   - confirm audit log entry,
   - update internal reconciliation sheet.

## Hard Rules

- Do not approve withdrawals with unresolved KYC.
- Do not approve withdrawals while Redis/DB/queue health is degraded unless leadership accepts manual risk.
- Do not process large payout batches during price-feed incidents.
