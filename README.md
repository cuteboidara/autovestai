# AutovestAI

**Full-stack trading and broker operations infrastructure built around real-time market data, execution, risk, treasury operations, and administrative controls.**

AutovestAI is an engineering project exploring the infrastructure behind a modern multi-asset trading platform — from the client terminal through execution and position management to backoffice operations, treasury reconciliation, surveillance, and system readiness.

**Live:** https://autovestai.io

---

## Architecture

```text
                         ┌─────────────────────┐
                         │   Market Providers  │
                         │ Binance · TwelveData│
                         │ CoinGecko · FX etc. │
                         └──────────┬──────────┘
                                    │
                                    ▼
┌─────────────────┐       ┌─────────────────────┐
│  Next.js Client │◄─────►│     NestJS API      │
│                 │       │                     │
│ Trading Terminal│       │ Pricing             │
│ Wallet          │       │ Execution           │
│ Positions       │       │ Risk / Liquidation  │
│ Account         │       │ Copy Trading        │
└─────────────────┘       └──────────┬──────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              PostgreSQL          Redis           BullMQ
              + Prisma          realtime         workers
                    │
                    ▼
             Operational Data
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
    Admin Backoffice      Socket.IO Layer
    Risk · Treasury       Quotes · Positions
    KYC · Surveillance    Exposure · Wallets
```

---

## Core Systems

### Trading Engine

The backend implements core broker-domain workflows including:

- real-time pricing
- order execution
- position lifecycle management
- leverage controls
- liquidation
- exposure monitoring
- copy trading
- dealing-desk controls

### Real-Time Infrastructure

Socket.IO and external market-data streams power real-time updates for:

- quotes
- candles
- positions
- wallet state
- exposure
- hedge state

The pricing layer includes stale-quote detection and configurable reconnection behaviour.

### Treasury & Reconciliation

AutovestAI includes an operational reconciliation system designed to compare observed treasury balances against internal client liabilities.

The system tracks:

- treasury balance snapshots
- internal client liabilities
- pending withdrawals
- approved-but-not-sent outflows
- reconciliation history
- operational deficits and warnings

```text
Gross Difference
= Treasury Balance - Internal Client Liabilities

Operational Difference
= Treasury Balance
- Internal Client Liabilities
- Approved Unsent Withdrawals
```

Reconciliation runs are persisted for administrative review and investigation.

### Backoffice & Risk Controls

The administrative system includes:

- RBAC and permission-aware actions
- KYC workflows
- immutable audit logging
- surveillance alerts
- case management
- treasury monitoring
- reconciliation console
- operational readiness checks
- affiliate management
- dealing-desk controls

### Authentication & Security

Security controls include:

- JWT access and refresh-token architecture
- server-side session persistence
- device fingerprint tracking
- permission-based admin authorization
- rate limiting on sensitive routes
- structured request logging
- request IDs
- Helmet security middleware
- explicit CORS configuration

---

## Asset Activation Pipeline

The repository includes a Python-based activation layer for transforming broker contract specifications into a normalized instrument registry.

```text
Contract Specification PDF
          │
          ▼
      PDF Parser
          │
          ▼
 Instrument Extraction
          │
          ▼
 Symbol Normalization
          │
          ▼
 Provider Mapping
          │
          ▼
 Normalized Instrument Registry
```

The pipeline:

- extracts contract rows by document section
- normalizes broker symbols into canonical instruments
- maps instruments to available market-data providers
- identifies unresolved or partial mappings
- generates machine-readable activation artifacts
- provides normalized data for Prisma seeding

Supported/provider mappings include:

- Yahoo Finance
- Stooq
- Alpha Vantage
- Twelve Data
- Financial Modeling Prep
- CoinGecko
- Binance
- ExchangeRate.host
- FRED

Generated artifacts include JSON and CSV instrument registries, unresolved mappings, and activation reports.

---

## Technology

### Backend

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Socket.IO

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand
- Socket.IO Client

### Data & Infrastructure

- Docker
- Docker Compose
- PostgreSQL
- Redis
- Prisma migrations
- REST APIs
- WebSockets
- external market-data providers

### Additional Engineering

- Python asset-processing pipeline
- background jobs
- health/readiness monitoring
- treasury reconciliation
- real-time market feeds

---

## Repository Structure

```text
autovestai/
├── app/                 # Asset activation tooling
├── activation_output/   # Generated instrument registries
├── docs/                # Technical documentation
├── frontend/            # Next.js client + admin applications
├── prisma/              # Database schema and migrations
├── scripts/             # Operational/development scripts
├── src/                 # NestJS backend
├── tests/               # Backend tests
└── docker-compose.yml
```

---

## Health & Operational Readiness

The backend exposes health and administrative readiness endpoints including:

```text
GET  /health
GET  /health/live
GET  /health/ready

GET  /admin/metrics
GET  /admin/readiness

GET  /admin/treasury/summary
GET  /admin/treasury/balance-snapshots
POST /admin/treasury/balance-snapshots

GET  /admin/reconciliation/latest
GET  /admin/reconciliation/runs
POST /admin/reconciliation/run
```

These endpoints support infrastructure monitoring as well as operational treasury and reconciliation workflows.

---

## Local Development

### 1. Clone

```bash
git clone https://github.com/cuteboidara/autovestai.git
cd autovestai
```

### 2. Configure the backend

```bash
cp .env.example .env
```

Populate the required local credentials.

Never commit real credentials, wallet mnemonics, private keys, or production secrets.

### 3. Configure the frontend

```bash
cp frontend/.env.example frontend/.env.local
```

### 4. Install dependencies

Backend:

```bash
npm install
```

Frontend:

```bash
cd frontend
npm install
cd ..
```

### 5. Prepare the database

```bash
npx prisma generate
npx prisma migrate dev --name local_setup
```

### 6. Run

Backend:

```bash
npm run start:dev
```

Frontend:

```bash
cd frontend
npm run dev
```

---

## Docker

The development stack can also be started with:

```bash
docker compose up --build
```

Default services:

| Service | Address |
|---|---|
| API | `http://localhost:3000` |
| Frontend | `http://localhost:3001` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

---

## Testing & Build

Backend:

```bash
npm run lint
npm run build
npm run test
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
npm run test
```

---

## Production Considerations

Production deployments should:

- use independently generated high-entropy secrets
- keep PostgreSQL and Redis on private networks
- run database migrations before application startup
- explicitly configure allowed CORS origins
- terminate TLS at the edge/ingress
- secure wallet and treasury credentials outside source control
- configure production-grade monitoring and alerting
- verify system readiness before enabling client access
- use licensed market/charting assets where required

---

## Status

AutovestAI is a software engineering project demonstrating the architecture and operational systems involved in building trading-platform infrastructure.

It should not be interpreted as a representation that every external financial, brokerage, custody, market-data, or payment integration is licensed or operating in production.
