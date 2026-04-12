# Incident Runbook

## Mass Liquidation Event

1. Confirm it is market-driven, not stale-quote driven.
2. Check symbol health immediately.
3. Disable trading if quote health is questionable.
4. Export affected users and realized PnL.
5. Sample audit logs and liquidation events.

## Suspicious Activity / Surveillance Escalation

1. Open the alert and linked user details.
2. Check:
   - sessions/devices,
   - KYC status,
   - wallet requests,
   - affiliate links,
   - copy-trading links.
3. Create/update surveillance case.
4. Freeze withdrawals or trading via kill switches if needed.

## Copy-Trading Incident

1. Disable copy trading if replication quality is in doubt.
2. Review:
   - skipped trades,
   - failed trades,
   - slippage patterns,
   - follower complaints.
3. Keep manual record of affected master/follower IDs.
4. Do not re-enable until root cause is clear.

## Affiliate Commission Dispute

1. Pull commission rows for the disputed order/user.
2. Check referral linkage and parent hierarchy.
3. Check audit logs for parent reassignment or payout decisions.
4. If payout already left the platform, escalate before making any offsetting decision.

## Suspicious Wallet Activity

1. Freeze withdrawals if behavior suggests fraud or laundering.
2. Review recent deposits, withdrawals, trade count, and KYC state.
3. Escalate to compliance before releasing funds.
