# Daily Ops Checks

## Start Of Day

1. Open `/health/ready`, `/admin/metrics`, and `/admin/readiness`.
2. Confirm:
   - DB ok,
   - Redis ok,
   - queues not degraded,
   - no unhealthy symbols,
   - failed jobs not climbing.
3. Review pending:
   - withdrawals,
   - deposits,
   - KYC,
   - surveillance alerts.
4. Review dealing-desk exposure and hedge suggestions.
5. Review previous-day reconciliation exceptions before approving new payouts.

## During Day

1. Watch symbol health and queue backlog.
2. Sample audit logs for:
   - wallet approvals,
   - KYC decisions,
   - settings changes.
3. Keep maintenance mode ready if feed or Redis health degrades.

## End Of Day

1. Reconcile wallet balance movements against approved requests.
2. Export unresolved surveillance cases.
3. Confirm there are no unexplained open hedge suggestions or failed jobs.
4. Record incidents, manual overrides, and kill-switch usage.
