import {
  PricingProviderReason,
  PricingProviderStatus,
  PricingProviderStatusValue,
  PricingProviderTransport,
} from './pricing-provider.types';

export class HttpResponseError extends Error {
  constructor(
    readonly statusCode: number,
    readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${statusCode} for ${url}`);
    this.name = 'HttpResponseError';
  }
}

export function createProviderStatus(
  provider: string,
  transport: PricingProviderTransport,
): PricingProviderStatus {
  return {
    provider,
    transport,
    status: 'DISABLED',
    reason: 'no_symbols_configured',
    message: 'No symbols are assigned to this provider.',
    symbolCount: 0,
    lastUpdateAt: null,
    retryAt: null,
    recommendedAction: null,
    consecutiveFailures: 0,
  };
}

export function describeProviderFailure(
  provider: string,
  error: unknown,
): Pick<PricingProviderStatus, 'status' | 'reason' | 'message' | 'recommendedAction'> {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Unknown error';
  const message = rawMessage.trim() || 'Unknown error';
  const normalized = message.toLowerCase();

  if (error instanceof HttpResponseError && error.statusCode === 429) {
    return {
      status: 'RATE_LIMITED',
      reason: 'http_429',
      message,
      recommendedAction: `Reduce ${provider} request volume until the upstream rate limit window clears.`,
    };
  }

  if (
    normalized.includes('http 429') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return {
      status: 'RATE_LIMITED',
      reason: 'http_429',
      message,
      recommendedAction: `Reduce ${provider} request volume until the upstream rate limit window clears.`,
    };
  }

  if (
    normalized.includes('missing_api_key') ||
    normalized.includes('missing api key') ||
    normalized.includes('not configured')
  ) {
    return {
      status: 'MISCONFIGURED',
      reason: 'missing_api_key',
      message,
      recommendedAction: `Set the required ${provider} API key or disable the provider explicitly.`,
    };
  }

  if (
    normalized.includes('http 401') ||
    normalized.includes('http 403') ||
    normalized.includes('invalid api key') ||
    normalized.includes('auth failed')
  ) {
    return {
      status: 'MISCONFIGURED',
      reason: 'auth_failed',
      message,
      recommendedAction: `Verify the ${provider} credentials or disable the provider if it is not needed.`,
    };
  }

  if (
    normalized.includes('http 451') ||
    normalized.includes('geo-block') ||
    normalized.includes('geo block') ||
    normalized.includes('restricted location') ||
    normalized.includes('restricted country') ||
    normalized.includes('service unavailable from a restricted location')
  ) {
    return {
      status: 'DISCONNECTED',
      reason: 'geo_blocked',
      message,
      recommendedAction: `Disable ${provider} in geo-restricted environments and rely on the fallback provider chain.`,
    };
  }

  if (
    normalized.includes('ecconnrefused') ||
    normalized.includes('enotfound') ||
    normalized.includes('etimedout') ||
    normalized.includes('econnreset') ||
    normalized.includes('network') ||
    normalized.includes('socket hang up') ||
    normalized.includes('websocket was closed before the connection was established') ||
    normalized.includes('unexpected server response')
  ) {
    return {
      status: 'DISCONNECTED',
      reason: 'connection_failed',
      message,
      recommendedAction: `Check ${provider} network reachability and keep the fallback providers enabled.`,
    };
  }

  return {
    status: 'DEGRADED',
    reason: 'upstream_error',
    message,
    recommendedAction: `Review ${provider} logs and upstream responses if the condition persists.`,
  };
}

export function applyStaleProviderStatus(
  status: PricingProviderStatus,
  staleAfterMs: number,
  now = Date.now(),
): PricingProviderStatus {
  if (
    status.status !== 'OK' ||
    !status.lastUpdateAt ||
    !Number.isFinite(staleAfterMs) ||
    staleAfterMs <= 0
  ) {
    return status;
  }

  const ageMs = now - new Date(status.lastUpdateAt).getTime();

  if (!Number.isFinite(ageMs) || ageMs <= staleAfterMs) {
    return status;
  }

  return {
    ...status,
    status: 'DEGRADED',
    reason: 'stale_quotes',
    message: `No fresh quote update received for ${Math.max(Math.floor(ageMs / 1000), 1)}s.`,
    recommendedAction:
      status.transport === 'streaming'
        ? 'Check the live feed connection and keep polling fallbacks enabled.'
        : 'Check the upstream polling endpoint and retry window.',
  };
}

export function okProviderStatus(
  current: PricingProviderStatus,
  timestamp: string,
): PricingProviderStatus {
  return {
    ...current,
    status: 'OK',
    reason: null,
    message: null,
    lastUpdateAt: timestamp,
    retryAt: null,
    recommendedAction: null,
    consecutiveFailures: 0,
  };
}

export function providerStatusWithFailure(
  current: PricingProviderStatus,
  provider: string,
  error: unknown,
  retryAt?: number | null,
): PricingProviderStatus {
  const failure = describeProviderFailure(provider, error);

  return {
    ...current,
    status: failure.status,
    reason: failure.reason,
    message: failure.message,
    retryAt: retryAt ? new Date(retryAt).toISOString() : null,
    recommendedAction: failure.recommendedAction,
    consecutiveFailures: current.consecutiveFailures + 1,
  };
}

export function disabledProviderStatus(
  current: PricingProviderStatus,
  reason: Extract<PricingProviderReason, 'disabled_by_config' | 'no_symbols_configured'>,
  message: string,
  recommendedAction: string | null,
): PricingProviderStatus {
  return {
    ...current,
    status: 'DISABLED',
    reason,
    message,
    retryAt: null,
    recommendedAction,
    consecutiveFailures: 0,
  };
}

export function misconfiguredProviderStatus(
  current: PricingProviderStatus,
  reason: Extract<PricingProviderReason, 'missing_api_key' | 'auth_failed'>,
  message: string,
  recommendedAction: string,
): PricingProviderStatus {
  return {
    ...current,
    status: 'MISCONFIGURED',
    reason,
    message,
    retryAt: null,
    recommendedAction,
    consecutiveFailures: 0,
  };
}
