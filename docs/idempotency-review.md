# Idempotency And Duplicate Action Review

## Summary

This pass hardened the worst duplicate-action paths, but not every endpoint is formally idempotent yet.

## Protections Now In Place

| Action | Current Protection | Status |
|---|---|---|
| Deposit approval / rejection | Pending-state guard plus transactional recheck | Good for alpha |
| Withdrawal approval / rejection | Pending-state guard, transactional recheck, free-margin revalidation | Good for alpha |
| Order placement | `clientRequestId` per user, DB uniqueness, frontend request id generation | Good for alpha |
| Position close | Open-state recheck in transaction + rate limit | Good for alpha |
| Hedge approval / rejection | Only `SUGGESTED -> APPROVED/REJECTED`; same-status retry is harmless | Good for alpha |
| KYC approve / reject | Only `PENDING -> APPROVED/REJECTED`; same terminal state returns existing row | Good for alpha |
| Commission payout | Only `APPROVED -> PAID`, transactional wallet credit | Good for alpha |
| Copy-trade replication jobs | Bull job ids, deterministic follower order request id, unique copy-trade linkage | Improved, still beta-risky |
| Session logout / revoke | Revocation update on stored session row | Acceptable |

## What Changed In This Pass

- Added `Order.clientRequestId`.
- Added deterministic copy-trade order ids: `copy:{masterPositionId}:{followerUserId}`.
- Added `CopyTrade(masterPositionId, followerUserId)` uniqueness.
- Added `AffiliateCommission(affiliateId, orderId)` uniqueness.
- Tightened KYC and hedge terminal-state transitions.

## Remaining Gaps

### Client deposit / withdrawal submission

Current state:

- protected by rate limits,
- not protected by first-class client idempotency keys.

Risk:

- users can still double-submit request forms and create multiple pending requests.

Recommendation:

- acceptable for private alpha if operations manually review every request,
- add header-based idempotency keys before public wallet launch.

### Admin wallet decisions

Current state:

- safe from duplicate financial mutation because only pending requests can transition.

Gap:

- no explicit operator-facing idempotency token.

Recommendation:

- acceptable for alpha due status-guarded transitions.

### Logout / revoke

Current state:

- repeat revocation is harmless in practice.

Recommendation:

- acceptable as-is.

## Launch Position

- **Private alpha:** acceptable.
- **Controlled beta:** acceptable after deposit/withdraw request idempotency is added.
- **Public v1:** do not rely on rate limiting alone for client cash requests.
