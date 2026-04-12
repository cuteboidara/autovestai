# Market Data, Pricing, And Execution Resilience Review

## Summary

The major blocker in this area was execution against stale/bootstrap pricing. That is now fixed for order entry.

## Hardening Applied In This Pass

- Added quote staleness threshold via env config.
- Marked `bootstrap` and `fallback` quotes as unhealthy for execution.
- Rejected new order execution when quote health is bad.
- Added exponential reconnect backoff for Binance websocket reconnects.
- Kept in-memory quote flow alive even if Redis or candle persistence fails.
- Exposed symbol health in admin metrics and readiness.
- Prevented PnL/liquidation logic from acting on unhealthy quotes.

## Runtime Failure Modes

### Binance disconnect

Current behavior:

- reconnects with backoff,
- quotes remain cached,
- trading becomes unavailable once quotes are stale,
- charts may continue to show last known data until refresh.

Assessment:

- safe enough for alpha,
- not enough for broader launch without a second source.

### Stale price detection

Current behavior:

- controlled by `PRICE_QUOTE_STALE_MS`,
- order execution rejects stale/untrusted quotes,
- symbol health is visible to admins.

Assessment:

- this is the correct v1 safety posture.

### Synthetic symbol fallback

Current behavior:

- `XAUUSD` remains synthetic and locally driven.

Assessment:

- acceptable for alpha only if disclosed internally and operationally monitored.
- not a strong public-market representation.

### Order rejection on stale/no price

Current behavior:

- yes, now enforced.

Assessment:

- necessary and correct.

### Websocket reconnect safety

Current behavior:

- reconnect backoff added,
- admin-only events no longer leak to all sockets.

Assessment:

- materially improved.

### Candle generation under reconnect gaps

Current behavior:

- candles resume from the next tick,
- missed history is not backfilled.

Assessment:

- acceptable for alpha,
- not acceptable for polished public charting.

### Redis failure behavior

Current behavior:

- quote handling now keeps working in memory and logs persistence failures,
- health still reports Redis problems.

Assessment:

- improved operational safety,
- still requires operator action because queues and cache degrade together.

### Queue backlog effect on execution timing

Current behavior:

- backlog is visible in admin metrics,
- no dynamic throttling or priority lanes yet.

Assessment:

- acceptable for capped alpha load only.

## Recommended Operating Limits For Alpha

- Keep supported symbols to the current small set.
- Keep concurrent active users low enough that the 1-second PnL loop remains comfortably below 1 second of wall time.
- Treat stale symbol health as an immediate operator page.
- Disable new trading if Redis or market feed health degrades materially.

## Remaining Pre-Beta Improvements

1. Add secondary price source or manual failover source.
2. Backfill candles after reconnect gaps.
3. Add feed-latency and PnL-loop-latency dashboards.
4. Define explicit operator response thresholds for stale symbol health.
