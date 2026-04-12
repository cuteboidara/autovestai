# Release Checklist And Rollout Order

## Phase 1 — Local / Dev Verified

### Entry criteria

- schema compiles,
- backend/frontend build,
- backend/frontend tests pass.

### Exact checks

- `npx prisma generate`
- `npm run lint`
- `npm run build`
- `npm test`
- frontend lint/build/test

### Exit criteria

- green local verification,
- no unresolved type or test failures.

### Rollback conditions

- any build/test regression.

## Phase 2 — Staging Deployed

### Entry criteria

- docker/env config ready,
- database and Redis available,
- migrations reviewed.

### Exact checks

- apply migrations to clean staging,
- confirm `/health`, `/health/ready`, `/admin/readiness`,
- confirm websocket connectivity,
- confirm workers are consuming queues.

### Exit criteria

- healthy staging stack with no degraded core dependency.

### Rollback conditions

- failed migration,
- queue worker crash,
- stale symbol health without recovery.

## Phase 3 — Internal Admin UAT

### Entry criteria

- staging healthy,
- admin roles seeded.

### Exact checks

- login as different admin roles,
- verify permission-scoped UI and API blocking,
- review audit log entries for sensitive actions,
- verify maintenance banner and kill switches.

### Exit criteria

- operators can execute daily workflows without blocked dependencies.

### Rollback conditions

- permission leakage,
- missing audit entries,
- dangerous admin UI ambiguity.

## Phase 4 — Wallet / KYC Workflow UAT

### Entry criteria

- admin UAT passed,
- operators trained.

### Exact checks

- submit/approve/reject KYC,
- submit/approve/reject deposit,
- submit/reject/approve withdrawal,
- confirm KYC is required for withdrawals,
- confirm audit trail and user-facing states.

### Exit criteria

- no inconsistent balance or status transitions found.

### Rollback conditions

- mismatched wallet balance,
- missing audit log,
- incorrect KYC gating.

## Phase 5 — Trading Engine UAT

### Entry criteria

- wallet/KYC UAT passed,
- symbol configs reviewed.

### Exact checks

- market order success,
- insufficient-margin rejection,
- limit order wait/trigger,
- PnL update loop,
- liquidation path,
- stale quote rejection,
- trading kill switch behavior.

### Exit criteria

- execution behaves correctly under healthy and unhealthy quote conditions.

### Rollback conditions

- execution on stale prices,
- incorrect margin math,
- failed liquidation behavior.

## Phase 6 — Private Alpha With Test Users

### Entry criteria

- internal UAT passed,
- operator runbooks approved,
- support rotation active.

### Exact checks

- invite-only users only,
- manual reconciliation every day,
- daily audit sample,
- daily symbol health review,
- copy trading and affiliate payouts remain limited or disabled.

### Exit criteria

- one full week without unresolved financial exceptions.

### Rollback conditions

- unexplained balance discrepancy,
- repeated unhealthy symbols,
- queue backlog causing execution delay,
- operator error patterns not under control.

## Phase 7 — Controlled Beta

### Entry criteria

- private alpha stable,
- top support issues understood,
- staging rollback drill completed.

### Exact checks

- increase user count slowly,
- review PnL loop latency and websocket load,
- tighten surveillance tuning,
- review affiliate and copy-trading abuse patterns before any expansion.

### Exit criteria

- stable operations under increased but still controlled load.

### Rollback conditions

- alert noise overwhelms ops,
- reconciliation lag,
- latency or backlog regressions.

## Phase 8 — Public Release

### Entry criteria

- wallet settlement lifecycle upgraded,
- migration discipline proven,
- copy trading/affiliates either hardened or explicitly cut,
- operational metrics stable through beta.

### Exact checks

- production readiness checklist all green or explicitly signed off,
- support and incident rotations staffed,
- backup/restore drill passed,
- rollback plan rehearsed.

### Exit criteria

- leadership accepts residual risk in writing.

### Rollback conditions

- any material financial inconsistency,
- security leak,
- auditability gap,
- sustained degraded market data or queue behavior.
