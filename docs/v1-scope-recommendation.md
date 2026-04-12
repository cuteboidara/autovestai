# V1 Scope Recommendation

## Recommended Release Matrix

| Surface / Module | Private Alpha | Controlled Beta | Public V1 | Recommendation |
|---|---|---|---|---|
| Client dashboard | Yes | Yes | Yes | Launch now |
| Trading terminal (market + limit only) | Yes | Yes | Maybe | Launch with manual controls |
| Wallet deposits (manual approval) | Yes | Yes | Maybe | Launch with manual controls |
| Wallet withdrawals (manual approval) | Yes | Yes | No | Launch with manual controls in alpha/beta only |
| Manual KYC workflow | Yes | Yes | Yes | Launch now |
| Admin backoffice / readiness / audit | Yes | Yes | Internal only | Launch now |
| Dealing desk dashboard | Internal only | Internal only | Internal only | Launch now for ops only |
| Surveillance | Internal only | Internal only | Internal only | Launch now for ops only |
| Copy trading | Invite only | Maybe | No | Beta only |
| Affiliates / referrals | Internal or invite only | Maybe | No | Beta only |
| Affiliate payouts | No | Invite only | No | Defer |
| Public chart polish / reconnect backfill | Basic only | Improve | Required | Beta only |
| Mobile-first experience | No | Limited | Required | Beta only |
| Advanced order types | No | No | No | Defer |
| AI/user-facing intelligence features | No | No | No | Defer |

## Brutal Scope Cut

### Keep For Private Alpha

- auth and sessions,
- manual KYC,
- wallet requests with manual approval,
- market + limit orders only,
- positions and liquidation,
- admin backoffice,
- audit, RBAC, health, readiness.

### Keep Out Of Public Launch

- copy trading,
- affiliate payouts,
- any public claim of fully mature crypto treasury operations,
- advanced order types,
- AI-facing product promises.

## Why

- The trading core is good enough for supervised alpha.
- The operations layer is usable, but still operator-dependent.
- Copy trading and affiliates are the fastest way to multiply support load, abuse, and reconciliation mistakes.

## Recommendation

- **Private alpha:** launch.
- **Controlled beta:** only after wallet ops discipline and staging/UAT are complete.
- **Public v1:** cut copy trading and affiliate payouts unless the team accepts materially higher operational risk.
