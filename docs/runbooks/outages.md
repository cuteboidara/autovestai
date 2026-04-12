# Outage Runbook

## Price Feed Outage

1. Check symbol health in admin metrics.
2. If unhealthy symbols persist:
   - enable maintenance mode,
   - disable global trading if needed.
3. Confirm new orders are being rejected on stale quotes.
4. Notify operators/support.
5. Do not re-enable trading until symbol health returns to normal.

## Redis Outage

1. Confirm via `/health/ready`.
2. Expect:
   - cache degradation,
   - queue disruption,
   - websocket instability.
3. Enable maintenance mode.
4. Disable trading.
5. Recover Redis, then verify:
   - workers resumed,
   - queue backlog is under control,
   - symbol health recovered.

## DB Outage

1. Immediately enable maintenance mode.
2. Disable trading and withdrawals.
3. Treat all admin approvals as frozen.
4. Recover DB service.
5. Validate:
   - migrations intact,
   - latest financial rows present,
   - queues not replaying incorrectly.

## Rollback / Maintenance Mode

1. Enable maintenance mode banner first.
2. Disable trading and withdrawals.
3. Freeze admin financial approvals except emergency reversals approved by leadership.
4. Roll back app version only after DB compatibility is understood.
