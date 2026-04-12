# AutovestAI Go-Live Assessment

## Verdict

AutovestAI is **not ready for public v1**.

After the hardening changes in this pass, it is **conditionally ready for private alpha** if:

1. a real Prisma migration chain is created and rehearsed,
2. staging is deployed with PostgreSQL, Redis, BullMQ workers, and frontend env parity,
3. wallet ops remain fully manual with written reconciliation steps,
4. copy trading and affiliate payouts stay out of the public launch path.

## Fixes Applied In This Pass

- Added global kill switches for trading, registrations, withdrawals, copy trading, affiliate payouts, and a maintenance banner.
- Added public platform status for frontend gating and operator visibility.
- Rejected order execution on unhealthy or stale quotes instead of bootstrap/fallback pricing.
- Added symbol health to admin metrics/readiness.
- Added order idempotency with `clientRequestId`, deterministic copy-order dedupe, and stricter commission/copy uniqueness.
- Tightened KYC, hedge, and other admin terminal-state transitions.
- Scoped admin realtime events to admin sockets instead of broadcasting to all connected clients.
- Required approved KYC before withdrawal requests.

## Critical Blockers

| Issue | Area | Why It Matters | Exact Remediation | Launch Recommendation |
|---|---|---|---|---|
| No committed Prisma migration history / baseline migration discipline | Data model / deployment | The codebase now depends on schema changes that are not proven through a real migration path. Production launch without a rehearsed migration and rollback path is reckless. | Create a baseline migration from the current schema, apply it in staging from a clean database, restore from backup, and rehearse deploy/rollback. | Must fix before any real-money users. |
| No staged runtime validation of queue workers, Redis, market feed, and frontend/backend env parity | Runtime / deployment | Build and tests pass, but there is still no evidence that the live stack behaves correctly under real services and disconnect conditions. | Deploy staging, run end-to-end UAT for login, deposit approval, withdrawal rejection/approval, order execution, liquidation, copy-trade open/close, and reconnect scenarios. | Must fix before any real users. |
| Wallet cash lifecycle is still too simple for public launch | Wallet ops / finance | Deposit and withdrawal statuses are still review-centric, not settlement-centric. There is no explicit on-chain broadcast/completion model, tx hash workflow, or automated reconciliation. | Keep wallet ops manual for alpha. Before public launch, add explicit settlement states, tx hash storage, reconciliation reporting, and daily exception handling. | Private alpha only with manual controls. |
| No proven backup/restore drill for financial and audit data | Operations | Immutable audit logs and wallet records only matter if they are recoverable. | Run a restore drill from production-like backups and document RPO/RTO. | Must fix before broader launch. |

## High-Priority Risks

| Issue | Area | Why It Matters | Exact Remediation | Launch Recommendation |
|---|---|---|---|---|
| Single external market source plus synthetic defaults | Pricing / execution | Binance disconnects or degraded feeds can halt healthy execution. This pass now rejects unhealthy quotes, but there is still no second price source or reconnect gap backfill. | Add secondary market data source or manual failover before beta. Keep tight symbol health monitoring in alpha. | Launch only with manual mitigation. |
| PnL loop is O(open positions) every second | Runtime bottleneck | Fine at alpha scale, risky at larger books. The engine will degrade with many open positions and symbols. | Cap alpha exposure/users, track loop latency, and move to symbol-bucket or incremental marking before beta scale. | Acceptable for controlled alpha only. |
| No operator step-up controls for admin payouts/settings/role changes | Security / ops | RBAC exists, audit exists, but there is still no second factor or maker-checker workflow. | Enforce two-person review or external ticket approval for wallet payouts, settings changes, and admin role grants. | Launch only with manual mitigation. |
| Surveillance is useful but still high-noise | Surveillance | Current rules are broad and intentionally conservative. Operators can get alert fatigue quickly. | Run daily tuning during first 2 weeks, suppress repeated known-benign patterns, and sample alert precision. | Acceptable for private alpha. |
| Copy trading still carries outsized operational risk | Copy trading | Dedupe is better now, but copied execution still compounds slippage, follower constraints, and operational support load. | Keep copy trading invite-only or internal-only until staging and alpha behavior are observed. | Beta only. |

## Medium-Priority Items

| Issue | Area | Why It Matters | Exact Remediation | Launch Recommendation |
|---|---|---|---|---|
| Candle reconnect gaps are not backfilled | Market data | Charts can show holes after feed interruptions. Trading is now blocked on unhealthy quotes, but chart continuity still suffers. | Backfill missed 1m bars from REST or alternate source before public charts matter. | Acceptable for controlled beta. |
| Session cleanup is missing | Auth / storage | Expired and revoked sessions will accumulate. | Add scheduled cleanup/archive job and retention policy. | Acceptable for beta. |
| Admin UX still allows operator mistakes under stress | Backoffice | Core pages work, but there is limited bulk tooling, explicit “four-eyes” review, or irreversible-action friction beyond confirmations. | Add action summaries, second-person approval for payouts/settings, and stronger filters. | Acceptable for alpha with trained operators. |
| Responsive/mobile operator experience is secondary | Frontend | Desktop-first is fine for launch ops, weak for broader public usage. | Keep desktop-only support policy for alpha/beta ops. | Acceptable for controlled beta. |

## Deferred Items

| Issue | Area | Why It Matters | Exact Remediation | Launch Recommendation |
|---|---|---|---|---|
| Advanced order types | Trading | Not needed for initial launch safety. | Defer until execution and ops are stable. | Defer. |
| Automated affiliate payouts at scale | Affiliates | Manual payout is safer initially. | Keep payout manual until abuse and reconciliation patterns are understood. | Defer. |
| AI-facing user features | Product | No direct launch-safety value. | Keep out of launch path. | Defer. |

## Area-By-Area Assessment

### Auth / sessions

- Access + refresh sessions are in place.
- Session hashes are stored server-side.
- Device fingerprinting exists.
- Remaining gap: no automated cleanup of expired sessions, and no MFA / step-up control.

### RBAC enforcement

- Admin routes use permission checks, not only `role=admin`.
- Remaining gap: operationally sensitive actions still need human dual control, not just software permission checks.

### Wallet approval flow / ledger consistency

- Request/approve/reject flow exists and now blocks withdrawals without approved KYC.
- Main weakness is lifecycle depth, not pure code correctness: approval currently acts as effective settlement.

### Margin / liquidation / order lifecycle

- Server-side margin checks, bid/ask execution, PnL, and liquidation are present.
- This pass blocked execution on unhealthy quotes and reduced duplicate order risk.
- Remaining scale risk is the 1-second full-book mark-to-market loop.

### Price feed / candles / websocket lifecycle

- This pass added stale-quote rejection, reconnect backoff, symbol health, and safer admin websocket scoping.
- Remaining gaps are gap backfill and secondary-source resilience.

### Copy trading / affiliates / dealing desk

- Safer than before, but still support-heavy and abuse-prone.
- Good enough for controlled/operator-supervised alpha, not for public launch.

### KYC / audit / surveillance

- Manual KYC, immutable audit logging, and surveillance are present.
- They are useful now, but not mature enough to justify public-scale trust without tighter ops discipline.

## Launch Recommendation

- **Public v1:** no.
- **Controlled beta:** not yet.
- **Private alpha:** yes, but only after migration/staging/UAT blockers are cleared and with wallet ops, copy trading, and affiliate payouts tightly controlled.
