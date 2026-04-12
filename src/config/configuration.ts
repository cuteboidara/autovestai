export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    adminPath:
      process.env.ADMIN_PATH?.trim().replace(/^\/+|\/+$/g, '') || 'control-tower',
    corsOrigins:
      process.env.CORS_ORIGINS?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean) ?? ['http://localhost:3000', 'http://localhost:3001'],
  },
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/autovestai?schema=public',
  redis: {
    url: process.env.REDIS_URL?.trim() || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'local-dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ??
      process.env.JWT_SECRET ??
      'local-dev-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },
  superAdmin: {
    email:
      process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
      'admin@autovestai.com',
    password:
      process.env.SUPER_ADMIN_PASSWORD?.trim() || 'changeme123',
  },
  bootstrapAdminEmails:
    process.env.BOOTSTRAP_ADMIN_EMAILS?.split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean) ?? [],
  pricing: {
    binanceWsUrl:
      process.env.BINANCE_WS_URL ??
      'wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker',
    twelveDataApiKey: process.env.TWELVE_DATA_API_KEY ?? '',
    twelveDataWsSymbols:
      process.env.TWELVE_DATA_WEBSOCKET_SYMBOLS?.split(',')
        .map((symbol) => symbol.trim())
        .filter(Boolean) ?? [],
    xauBasePrice: Number.parseFloat(process.env.XAU_BASE_PRICE ?? '2300'),
    // FIX: Default stale threshold is relaxed so brief upstream quote gaps do not
    // immediately degrade the terminal for otherwise healthy feeds.
    quoteStaleMs: Number.parseInt(process.env.PRICE_QUOTE_STALE_MS ?? '60000', 10),
    reconnectInitialDelayMs: Number.parseInt(
      process.env.PRICE_RECONNECT_INITIAL_DELAY_MS ?? '2000',
      10,
    ),
    reconnectMaxDelayMs: Number.parseInt(
      process.env.PRICE_RECONNECT_MAX_DELAY_MS ?? '30000',
      10,
    ),
  },
  risk: {
    maxLeverage: Number.parseInt(process.env.MAX_LEVERAGE ?? '20', 10),
  },
  queue: {
    orderExecution: 'order-execution',
  },
  security: {
    helmetEnabled: process.env.HELMET_ENABLED !== 'false',
  },
  uploads: {
    rootDir: process.env.UPLOADS_ROOT_DIR?.trim() || 'uploads',
    kycDir: process.env.KYC_UPLOAD_DIR?.trim() || 'uploads/kyc',
  },
  email: {
    encryptionSecret:
      process.env.EMAIL_ENCRYPTION_SECRET ??
      process.env.JWT_SECRET ??
      'local-dev-secret',
  },
  wallet: {
    masterMnemonic:
      process.env.WALLET_MASTER_MNEMONIC ??
      process.env.MASTER_SEED ??
      '',
    ethRpcUrl: process.env.ETH_RPC_URL ?? 'https://eth.llamarpc.com',
    tronApiUrl: process.env.TRON_API_URL ?? 'https://api.trongrid.io',
    tronApiKey:
      process.env.TRON_API_KEY ??
      process.env.TRONGRID_API_KEY ??
      '',
    etherscanApiKey: process.env.ETHERSCAN_API_KEY ?? '',
    bscRpcUrl: process.env.BSC_RPC_URL ?? 'https://bsc-dataseed.binance.org',
    blockstreamApiUrl: process.env.BLOCKSTREAM_API_URL ?? 'https://blockstream.info/api',
    masterWalletTrc20:
      process.env.MASTER_WALLET_TRC20 ??
      process.env.TREASURY_MASTER_WALLET_ADDRESS ??
      '',
    masterWalletErc20:
      process.env.MASTER_WALLET_ERC20 ??
      '',
  },
  treasury: {
    masterWalletAddress:
      process.env.TREASURY_MASTER_WALLET_ADDRESS ??
      process.env.MASTER_WALLET_TRC20 ??
      process.env.MASTER_WALLET_ERC20 ??
      '',
    asset: process.env.TREASURY_ASSET ?? 'USDT',
    network: process.env.TREASURY_NETWORK ?? 'TRC20',
    explorerBaseUrl: process.env.TREASURY_EXPLORER_BASE_URL ?? '',
    monitoringMode: process.env.TREASURY_MONITORING_MODE ?? 'manual',
    staleSnapshotHours: Number.parseInt(
      process.env.TREASURY_SNAPSHOT_STALE_HOURS ?? '24',
      10,
    ),
    pendingWithdrawalWarningThreshold: Number.parseFloat(
      process.env.TREASURY_PENDING_WITHDRAWAL_WARNING_THRESHOLD ?? '10000',
    ),
    reconciliationTolerance: Number.parseFloat(
      process.env.TREASURY_RECONCILIATION_TOLERANCE ?? '0.01',
    ),
  },
  reconciliation: {
    tolerance: Number.parseFloat(process.env.RECONCILIATION_TOLERANCE ?? '1'),
    staleSnapshotHours: Number.parseInt(
      process.env.RECONCILIATION_STALE_SNAPSHOT_HOURS ?? '12',
      10,
    ),
    highPendingWithdrawalsThreshold: Number.parseFloat(
      process.env.RECONCILIATION_HIGH_PENDING_WITHDRAWALS_THRESHOLD ?? '1000',
    ),
    approvedOutflowThreshold: Number.parseFloat(
      process.env.RECONCILIATION_APPROVED_OUTFLOW_THRESHOLD ?? '1000',
    ),
    enableScheduledRuns:
      (process.env.RECONCILIATION_ENABLE_SCHEDULED_RUNS ?? 'false').toLowerCase() ===
      'true',
    scheduleIntervalHours: Number.parseInt(
      process.env.RECONCILIATION_SCHEDULE_INTERVAL_HOURS ?? '12',
      10,
    ),
  },
});
