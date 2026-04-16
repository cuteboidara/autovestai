import {
  HttpResponseError,
  applyStaleProviderStatus,
  createProviderStatus,
  describeProviderFailure,
  okProviderStatus,
} from './provider-health.util';

describe('provider-health util', () => {
  it('classifies HTTP 429 responses as RATE_LIMITED', () => {
    expect(
      describeProviderFailure(
        'CoinGecko',
        new HttpResponseError(429, 'https://api.coingecko.com/api/v3/simple/price'),
      ),
    ).toMatchObject({
      status: 'RATE_LIMITED',
      reason: 'http_429',
    });
  });

  it('classifies missing API keys as MISCONFIGURED', () => {
    expect(
      describeProviderFailure('Twelve Data', new Error('TWELVE_DATA_API_KEY not configured')),
    ).toMatchObject({
      status: 'MISCONFIGURED',
      reason: 'missing_api_key',
    });
  });

  it('classifies geo-restricted failures as DISCONNECTED', () => {
    expect(
      describeProviderFailure(
        'Binance',
        new Error('Unexpected server response: 451 Service unavailable from a restricted location'),
      ),
    ).toMatchObject({
      status: 'DISCONNECTED',
      reason: 'geo_blocked',
    });
  });

  it('marks stale successful providers as DEGRADED with stale_quotes', () => {
    const healthyStatus = okProviderStatus(
      createProviderStatus('yahoo-finance', 'polling'),
      '2026-04-16T10:00:00.000Z',
    );

    expect(
      applyStaleProviderStatus(
        healthyStatus,
        60_000,
        new Date('2026-04-16T10:02:30.000Z').getTime(),
      ),
    ).toMatchObject({
      status: 'DEGRADED',
      reason: 'stale_quotes',
    });
  });
});
