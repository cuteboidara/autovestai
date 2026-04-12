# Database And Financial Integrity Review

## Summary

The schema is now materially safer than before this pass, but it still reflects an **operator-managed broker alpha**, not a public-scale finance backend.

## Fixes Applied

| Change | Why |
|---|---|
| `Order @@unique([userId, clientRequestId])` | Prevent duplicate order execution for retried/manual double submissions. |
| `CopyTrade @@unique([masterPositionId, followerUserId])` | Prevent duplicate follower linkage for the same master position. |
| `AffiliateCommission @@unique([affiliateId, orderId])` | Prevent duplicate commission creation for the same affiliate/order pair. |
| `AffiliateCommission.createMany(..., skipDuplicates: true)` | Makes retry behavior safer under race/replay. |
| `UserSession.refreshTokenHash @unique` | Ensures refresh token rotation is backed by a strong lookup key. |
| `UserSession @@index([userId, revokedAt, expiresAt])` | Improves common session list/cleanup/read paths. |
| `AuditLog @@index([requestId, createdAt])` | Improves audit traceability by request lineage. |

## Integrity Review By Domain

### Wallet balances vs ledger

Current model:

- `wallet.balance` is the live cash ledger.
- `wallet.lockedMargin` is the margin reservation bucket.
- `transactions` record deposits, withdrawals, and trade cash events.

Assessment:

- Core balance mutations are transactional.
- Margin release on close/liquidation is transactional.
- The main weakness is semantic depth:
  - `APPROVED` currently behaves as a terminal state for wallet ops.
  - There is no explicit settlement lifecycle for blockchain broadcast / confirmed / failed / reversed.

Recommendation:

- Accept for low-volume private alpha with manual reconciliation.
- Before public launch, split wallet transaction lifecycle into review vs settlement states.

### Transaction atomicity

Current state:

- Order open/close financial effects are wrapped in DB transactions.
- Deposit/withdraw approval is wrapped in DB transactions.
- Affiliate payout is wrapped in a DB transaction.

Assessment:

- Good enough for current scale.
- Remaining concern is operational semantics, not missing transaction wrappers.

### Duplicate execution risk

Current risks before this pass:

- repeated order submits,
- repeated copy-trade worker execution,
- repeated affiliate commission generation.

Applied mitigations:

- order idempotency key,
- copy-trade unique linkage,
- deterministic copy order request id,
- affiliate commission uniqueness + duplicate skipping.

### Nullable fields that are still concerning

| Field | Concern | Recommendation |
|---|---|---|
| `Transaction.walletId` | Nullable for historical flexibility, but many flows assume it exists. | Accept for now; keep service-side checks. |
| `CopyTrade.followerPositionId` | Needed for skipped/failed trades. | Correctly nullable. |
| `AuditLog.actorUserId` | Needed for system actions. | Correctly nullable. |
| `KycSubmission.reviewedById` | Pending state requires null. | Correctly nullable. |

### Missing indexes still worth adding later

| Area | Recommendation |
|---|---|
| `Transaction(reference)` | Add if reference becomes a primary reconciliation key. |
| `TradeExecution(createdAt, symbol)` | Add when ops/reporting workloads increase. |
| `AuditLog(createdAt)` partitioning/archival | Plan before logs become large. |
| `SymbolExposureSnapshot(symbol, createdAt desc)` | Likely fine now, revisit for larger dashboards. |

### Cascade behavior

Assessment:

- Current cascades are acceptable for this stage because user deletion is not part of normal ops.
- In a regulated environment, hard deletes should effectively disappear from backoffice workflows.

Recommendation:

- Do not add user-deletion features.
- Move to soft-delete/archive semantics before broader launch.

### Status enum completeness

Assessment:

- Adequate for core trading flows.
- Not adequate for public wallet settlement reporting.

Recommendation:

- Before public wallet launch, extend deposit/withdraw status model to distinguish:
  - requested,
  - under_review,
  - approved_for_release,
  - sent,
  - confirmed,
  - failed,
  - reversed.

### Copy-trade linkage integrity

Assessment:

- Stronger now because duplicate follower linkage is blocked at DB level.
- Still not a fully two-phase replicated ledger.

Recommendation:

- Keep copy trading limited during alpha.

### Affiliate commission duplication risk

Assessment:

- Materially improved in this pass.
- The remaining risk is business policy, not duplicate row creation.

### Audit queryability

Assessment:

- Good enough for alpha investigations.
- Growth plan still needed for retention, archival, and partitioning.

### Session cleanup strategy

Assessment:

- Read/query performance is improved.
- There is still no scheduled cleanup job.

Recommendation:

- Add a daily cleanup/archive job before beta.

## Remaining Launch Constraints

1. The schema needs a real migration chain committed and tested.
2. Wallet settlement states still need refinement before public launch.
3. Cleanup/archive jobs for sessions and audit data are still missing.
