# First 30 Days Operations Plan

## Week 1

- Verify production and staging infrastructure health daily.
- Confirm migrations applied cleanly and `_prisma_migrations` matches release.
- Re-run seed/config sanity checks for admin roles and broker settings.
- Execute smoke tests each morning:
  - login,
  - deposit request,
  - deposit approval,
  - withdrawal request rejection,
  - market order,
  - position close,
  - platform status banner.
- Train operators on wallet, KYC, outage, and surveillance runbooks.
- Set up support queue ownership and escalation rotation.
- Perform daily wallet and balance reconciliation.

## Week 2

- Tune surveillance rules based on actual alert volume.
- Review spread/markup settings against real observed execution behavior.
- Review dealing-desk exposure thresholds by symbol.
- Add manual withdrawal fraud review sampling for every large request.
- Review copy-trading skips, failures, and slippage if copy trading is enabled for invite-only users.

## Week 3

- Run one incident drill:
  - stale price feed,
  - Redis failure,
  - queue backlog spike.
- Review latency of:
  - order execution,
  - PnL loop,
  - websocket delivery.
- Analyze top support issues and convert repeat incidents into admin UX fixes or runbook updates.
- Sample audit logs for wallet, KYC, settings, and hedge actions.

## Week 4

- Review broker revenue and rebate leakage.
- Review affiliate abuse indicators before expanding referral activity.
- Review KYC rejection patterns and false positives.
- Clean up unresolved alert/case backlog.
- Decide whether to:
  - stay in alpha,
  - expand to controlled beta,
  - keep copy trading/affiliates disabled.

## Non-Negotiable Daily Metrics

- pending withdrawals,
- open surveillance alerts,
- unhealthy symbols,
- queue backlog,
- failed jobs,
- open positions,
- unreviewed KYC,
- unresolved wallet exceptions.
