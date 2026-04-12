# Founder Launch Memo

## Can this launch now?

**Not for public v1.**

It is **close enough for a tightly controlled private alpha** after migration discipline and staging UAT are completed.

## What must be fixed first?

1. Commit and rehearse real Prisma migrations.
2. Run full staging UAT with live Postgres, Redis, workers, and market feed behavior.
3. Formalize manual wallet reconciliation and payout controls.
4. Run one backup/restore drill.

## What should be cut from v1?

- copy trading for public users,
- affiliate payouts,
- any public claim of mature crypto treasury automation,
- advanced order types,
- AI-facing product scope.

## Top 5 operational risks

1. Wallet ops are still manual and the settlement lifecycle is too simple for public release.
2. Market data still relies on a single external source with no backfill after reconnect gaps.
3. The 1-second PnL loop will become a bottleneck if user/position counts rise too fast.
4. Operator mistakes are still more likely than software bugs in wallet/KYC/settings workflows.
5. There is no committed migration/rollback history yet, which is a release-management risk on its own.

## Safest rollout path

1. Finish migration and staging rehearsal.
2. Launch internal/admin UAT.
3. Launch private alpha with invite-only users and daily reconciliation.
4. Expand to controlled beta only after one stable week and after copy trading / affiliate scope is re-evaluated.

## Bottom line

The platform is **good enough to learn with in private alpha**.

It is **not honest to call this public-launch ready yet**.
