# AutovestAI Platform

AutovestAI is a broker operations stack composed of:

- a NestJS trading and backoffice API
- a Next.js client terminal and admin backoffice
- PostgreSQL, Redis, BullMQ, and Socket.IO realtime services

The current codebase includes pricing, order execution, positions, liquidation, copy trading, affiliates, dealing desk controls, KYC, audit logging, RBAC, surveillance, health/readiness checks, and session/device security.

## Stack

- Backend: NestJS, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO
- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Zustand, Socket.IO client
- Infra: Docker, docker-compose

## Local Setup

1. Copy backend env values from [.env.example](/C:/Users/daram/autovestai/.env.example) into `.env`.
2. Copy frontend env values from [frontend/.env.example](/C:/Users/daram/autovestai/frontend/.env.example) into `frontend/.env.local`.
3. Install backend dependencies:

```bash
npm install
```

4. Install frontend dependencies:

```bash
cd frontend
npm install
cd ..
```

5. Generate Prisma client and apply schema changes:

```bash
npx prisma generate
npx prisma migrate dev --name local_setup
```

6. Start the backend:

```bash
npm run start:dev
```

7. Start the frontend:

```bash
cd frontend
npm run dev
```

## Docker Compose

For local containerized development:

```bash
docker compose up --build
```

Services exposed by [docker-compose.yml](/C:/Users/daram/autovestai/docker-compose.yml):

- API: `http://localhost:3000`
- Frontend: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Environment Notes

Backend env:

- `DATABASE_URL`
- `REDIS_URL`
- `REDIS_REQUIRED_ON_STARTUP`
- `FRONTEND_URL`
- `CORS_ORIGINS`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`
- `BINANCE_WS_URL`
- `XAU_BASE_PRICE`
- `MAX_LEVERAGE`
- `HELMET_ENABLED`
- `FRONTEND_TRADINGVIEW_ASSETS_ENABLED`
- `TREASURY_MASTER_WALLET_ADDRESS`
- `TREASURY_ASSET`
- `TREASURY_NETWORK`
- `DEPOSIT_WALLET_USDT_TRC20`
- `DEPOSIT_WALLET_USDT_ERC20`
- `DEPOSIT_WALLET_USDT_BEP20`
- `DEPOSIT_WALLET_BTC_BTC`
- `DEPOSIT_WALLET_ETH_ERC20`
- `DEPOSIT_WALLET_BNB_BEP20`
- `TREASURY_EXPLORER_BASE_URL`
- `TREASURY_MONITORING_MODE`
- `TREASURY_SNAPSHOT_STALE_HOURS`
- `TREASURY_PENDING_WITHDRAWAL_WARNING_THRESHOLD`
- `TREASURY_RECONCILIATION_TOLERANCE`
- `RECONCILIATION_TOLERANCE`
- `RECONCILIATION_STALE_SNAPSHOT_HOURS`
- `RECONCILIATION_HIGH_PENDING_WITHDRAWALS_THRESHOLD`
- `RECONCILIATION_APPROVED_OUTFLOW_THRESHOLD`
- `RECONCILIATION_ENABLE_SCHEDULED_RUNS`
- `RECONCILIATION_SCHEDULE_INTERVAL_HOURS`

Frontend env:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
- `NEXT_PUBLIC_TRADINGVIEW_ASSETS_ENABLED`

## Railway Deposit Wallet Fallback

If no active rows exist in the `DepositWallet` table yet, the backend deposit wallet endpoint falls
back to Railway environment variables using the pattern:

- `DEPOSIT_WALLET_<COIN>_<NETWORK>`

Examples:

- `DEPOSIT_WALLET_USDT_TRC20`
- `DEPOSIT_WALLET_USDT_ERC20`
- `DEPOSIT_WALLET_USDT_BEP20`
- `DEPOSIT_WALLET_BTC_BTC`
- `DEPOSIT_WALLET_ETH_ERC20`
- `DEPOSIT_WALLET_BNB_BEP20`

Optional metadata can also be supplied with:

- `DEPOSIT_WALLET_LABEL_<COIN>_<NETWORK>`
- `DEPOSIT_WALLET_MIN_<COIN>_<NETWORK>`

Legacy aliases such as `HOT_WALLET_<COIN>_<NETWORK>` and `WALLET_ADDRESS_<COIN>_<NETWORK>` are
also detected by the backend when present.

## Backend Operations

Common backend commands:

```bash
npx prisma generate
npx prisma migrate deploy
npm run lint
npm run build
npm run test
```

## Asset Activation

The repo now includes a Python activation layer that turns the contract-specification PDF into a complete normalized instrument registry for the broker universe.

Run it with:

```bash
C:\Python312\python.exe -m app.activate_assets --pdf Contract-Specifications.pdf --output-dir activation_output
```

What it does:

- parses the source PDF through the local `pdf-parse` Node helper
- extracts every contract row by PDF section
- normalizes broker symbols into canonical instruments
- maps each instrument to one or more free public data providers
- writes activation artifacts under `activation_output/`

Generated files:

- `activation_output/parsed_pdf_assets.json`
- `activation_output/parsed_pdf_assets.csv`
- `activation_output/instruments_master.json`
- `activation_output/instruments_master.csv`
- `activation_output/unresolved_mappings.json`
- `activation_output/activation_report.json`

Free providers modeled by the activation layer:

- Yahoo Finance
- Stooq
- Alpha Vantage
- Twelve Data
- Financial Modeling Prep
- CoinGecko
- Binance public endpoints
- ExchangeRate.host
- FRED

Notes:

- Some CFD/index/commodity symbols use documented benchmark or futures proxies and are marked `partial`.
- Some Mideast exchange suffixes are inferred heuristically and are also marked `partial` for manual review.
- The backend symbol loader now prefers `activation_output/instruments_master.json` when present, so Prisma seeding can consume the generated registry directly.

Health and readiness endpoints:

- `GET /health`
- `GET /health/live`
- `GET /health/ready`
- `GET /admin/metrics`
- `GET /admin/readiness`
- `GET /admin/treasury/summary`
- `GET /admin/treasury/balance-snapshots`
- `POST /admin/treasury/balance-snapshots`
- `GET /admin/treasury/movements`
- `GET /admin/treasury/reconciliation`
- `GET /admin/treasury/liabilities-breakdown`
- `POST /admin/reconciliation/run`
- `GET /admin/reconciliation/latest`
- `GET /admin/reconciliation/runs`
- `GET /admin/reconciliation/runs/:id`

Security and controls currently implemented:

- immutable audit logging
- refresh-token sessions stored server-side
- device fingerprint tracking
- permission-based admin authorization
- rate limiting on sensitive routes
- structured request logging and request IDs
- surveillance alerts and case management

## Frontend Operations

Common frontend commands:

```bash
cd frontend
npm run lint
npm run build
npm run test
```

Frontend highlights:

- protected public/client/admin route groups
- realtime quote, candle, position, wallet, exposure, and hedge updates
- profile session management UI
- admin surveillance queue
- admin readiness page
- admin treasury dashboard with manual balance snapshots and reconciliation warnings
- admin reconciliation console with persisted run history and operational deficit checks
- permission-aware admin navigation and actions

## Reconciliation

The reconciliation engine records treasury-vs-liabilities runs over time for owner/admin review.

- Gross difference: `treasuryBalance - internalClientLiabilities`
- Operational difference: `treasuryBalance - internalClientLiabilities - approvedButNotSentWithdrawalsTotal`
- Internal wallet ledger remains the source of truth for liabilities
- Treasury balance remains an observed custody layer

Recommended alpha ops flow:

1. Record or refresh a treasury balance snapshot.
2. Review pending withdrawals and approved-but-not-sent outflows.
3. Run reconciliation from the admin console.
4. Investigate any `WARNING` or `ERROR` run before releasing more outflows.

Detailed notes live in [docs/reconciliation.md](/C:/Users/daram/autovestai/docs/reconciliation.md).

## TradingView Assets

The terminal can run with a live fallback chart. If you have licensed TradingView Charting Library assets, place them under:

- [frontend/public/tradingview/charting_library](/C:/Users/daram/autovestai/frontend/public/tradingview/charting_library)

Set `FRONTEND_TRADINGVIEW_ASSETS_ENABLED=true` and `NEXT_PUBLIC_TRADINGVIEW_ASSETS_ENABLED=true` when those assets are present.

## Production Notes

- Use strong secrets for `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Run Prisma migrations before starting the API.
- Keep PostgreSQL and Redis on private networks in production.
- Terminate TLS at the edge or ingress.
- Configure `CORS_ORIGINS` explicitly for deployed frontend domains.
- Mount persistent volumes for PostgreSQL and Redis.
- Provide a real TradingView asset bundle if the licensed widget is required.
- Review the admin readiness page before enabling live client access.
