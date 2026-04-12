# Kill Switches

## Implemented In This Pass

Broker settings now support:

- global trading enabled,
- per-symbol trading enabled,
- registrations enabled,
- withdrawals enabled,
- copy trading enabled,
- affiliate program enabled,
- affiliate payouts enabled,
- maintenance mode enabled,
- maintenance message.

## Backend Enforcement

Current server-side behavior:

- `tradingEnabled=false`
  - blocks new order entry,
  - combines with symbol health to reject stale/unhealthy execution.
- `symbol.{symbol}.tradingEnabled=false`
  - blocks new order entry for that symbol.
- `registrationsEnabled=false`
  - blocks `POST /auth/register`.
- `withdrawalsEnabled=false`
  - blocks new withdrawal requests,
  - blocks withdrawal approvals.
- `copyTradingEnabled=false`
  - blocks new copy-master applications and follower configuration changes,
  - suppresses copy execution propagation.
- `affiliateProgramEnabled=false`
  - blocks affiliate application and referral linkage/use.
- `affiliatePayoutsEnabled=false`
  - blocks commission payout release.

## Frontend Behavior

The frontend now calls `GET /platform/status` and:

- shows a maintenance/restriction banner globally,
- disables registration when registrations are off,
- disables new order submission when global trading or symbol health blocks trading,
- disables withdrawal submission when withdrawals are off,
- disables copy-trading follow/application actions when copy trading is off,
- disables affiliate application when the affiliate program is off.

## Important Operational Note

The current global trading switch is implemented as a **new order-entry halt**, not a full close-only mode controller.

That means:

- it stops new exposure,
- it does not introduce a special “close-only” operational mode,
- liquidations still depend on quote health and current system logic.

## Recommended Operator Policy

- Use the global trading switch first during market/feed incidents.
- Use symbol-level disable when the incident is isolated.
- Use maintenance mode whenever the frontend should clearly warn users that actions are restricted.
- Disable affiliate payouts separately from the broader affiliate program if treasury review is the concern.
