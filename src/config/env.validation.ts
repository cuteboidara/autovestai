type EnvShape = Record<string, string | undefined>;

function ensurePositiveNumber(value: string | undefined, key: string): void {
  if (value === undefined) {
    return;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive number`);
  }
}

function ensureNonNegativeNumber(value: string | undefined, key: string): void {
  if (value === undefined) {
    return;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative number`);
  }
}

function ensureBooleanLike(value: string | undefined, key: string): void {
  if (value === undefined) {
    return;
  }

  if (!['true', 'false'].includes(value.toLowerCase())) {
    throw new Error(`${key} must be true or false`);
  }
}

function ensureSafePathSegment(value: string | undefined, key: string): void {
  if (value === undefined) {
    return;
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${key} must not be empty`);
  }

  if (!/^[A-Za-z0-9-]+$/.test(normalized)) {
    throw new Error(`${key} must contain only letters, numbers, and hyphens`);
  }
}

function ensureEmailLike(value: string | undefined, key: string): void {
  if (value === undefined) {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw new Error(`${key} must be a valid email address`);
  }
}

export function validateEnv(config: EnvShape): EnvShape {
  ensureSafePathSegment(config.ADMIN_PATH, 'ADMIN_PATH');
  ensurePositiveNumber(config.PORT, 'PORT');
  ensurePositiveNumber(config.XAU_BASE_PRICE, 'XAU_BASE_PRICE');
  ensurePositiveNumber(config.MAX_LEVERAGE, 'MAX_LEVERAGE');
  ensurePositiveNumber(config.PRICE_QUOTE_STALE_MS, 'PRICE_QUOTE_STALE_MS');
  ensurePositiveNumber(
    config.PRICE_RECONNECT_INITIAL_DELAY_MS,
    'PRICE_RECONNECT_INITIAL_DELAY_MS',
  );
  ensurePositiveNumber(
    config.PRICE_RECONNECT_MAX_DELAY_MS,
    'PRICE_RECONNECT_MAX_DELAY_MS',
  );
  ensurePositiveNumber(
    config.TREASURY_SNAPSHOT_STALE_HOURS,
    'TREASURY_SNAPSHOT_STALE_HOURS',
  );
  ensurePositiveNumber(
    config.TREASURY_PENDING_WITHDRAWAL_WARNING_THRESHOLD,
    'TREASURY_PENDING_WITHDRAWAL_WARNING_THRESHOLD',
  );
  ensureNonNegativeNumber(
    config.TREASURY_RECONCILIATION_TOLERANCE,
    'TREASURY_RECONCILIATION_TOLERANCE',
  );
  ensureNonNegativeNumber(
    config.RECONCILIATION_TOLERANCE,
    'RECONCILIATION_TOLERANCE',
  );
  ensurePositiveNumber(
    config.RECONCILIATION_STALE_SNAPSHOT_HOURS,
    'RECONCILIATION_STALE_SNAPSHOT_HOURS',
  );
  ensurePositiveNumber(
    config.RECONCILIATION_HIGH_PENDING_WITHDRAWALS_THRESHOLD,
    'RECONCILIATION_HIGH_PENDING_WITHDRAWALS_THRESHOLD',
  );
  ensurePositiveNumber(
    config.RECONCILIATION_APPROVED_OUTFLOW_THRESHOLD,
    'RECONCILIATION_APPROVED_OUTFLOW_THRESHOLD',
  );
  ensurePositiveNumber(
    config.RECONCILIATION_SCHEDULE_INTERVAL_HOURS,
    'RECONCILIATION_SCHEDULE_INTERVAL_HOURS',
  );
  ensureBooleanLike(
    config.RECONCILIATION_ENABLE_SCHEDULED_RUNS,
    'RECONCILIATION_ENABLE_SCHEDULED_RUNS',
  );
  ensureBooleanLike(
    config.COINGECKO_PROVIDER_ENABLED,
    'COINGECKO_PROVIDER_ENABLED',
  );
  ensureBooleanLike(config.BINANCE_PROVIDER_ENABLED, 'BINANCE_PROVIDER_ENABLED');
  ensureBooleanLike(
    config.TWELVE_DATA_PROVIDER_ENABLED,
    'TWELVE_DATA_PROVIDER_ENABLED',
  );
  ensureBooleanLike(config.FOREX_PROVIDER_ENABLED, 'FOREX_PROVIDER_ENABLED');
  ensureBooleanLike(config.YAHOO_PROVIDER_ENABLED, 'YAHOO_PROVIDER_ENABLED');
  ensureBooleanLike(config.REDIS_REQUIRED_ON_STARTUP, 'REDIS_REQUIRED_ON_STARTUP');
  ensureEmailLike(config.SUPER_ADMIN_EMAIL, 'SUPER_ADMIN_EMAIL');

  if (!config.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  if (!config.JWT_REFRESH_SECRET) {
    throw new Error('JWT_REFRESH_SECRET is required');
  }

  if (!config.MASTER_SEED && !config.WALLET_MASTER_MNEMONIC) {
    throw new Error('MASTER_SEED or WALLET_MASTER_MNEMONIC is required');
  }

  if (
    config.TREASURY_MONITORING_MODE &&
    !['manual', 'api'].includes(config.TREASURY_MONITORING_MODE.toLowerCase())
  ) {
    throw new Error('TREASURY_MONITORING_MODE must be manual or api');
  }

  if (
    config.TREASURY_ASSET &&
    config.TREASURY_ASSET.trim().toUpperCase() !== 'USDT'
  ) {
    throw new Error('TREASURY_ASSET must be USDT in alpha');
  }

  return config;
}
