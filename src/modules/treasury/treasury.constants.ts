export const TREASURY_SUPPORTED_ASSET = 'USDT' as const;
export const TREASURY_DEFAULT_NETWORK = 'TRC20';
export const TREASURY_API_SNAPSHOT_DEDUPE_WINDOW_MS = 5 * 60 * 1000;
export const TREASURY_SUPPORTED_API_NETWORKS = ['TRC20'] as const;

export function normalizeTreasuryNetwork(network?: string | null): string {
  const normalized = (network ?? TREASURY_DEFAULT_NETWORK).trim().toUpperCase();

  if (normalized === 'USDT-TRC20') {
    return 'TRC20';
  }

  if (normalized === 'USDT-ERC20') {
    return 'ERC20';
  }

  if (normalized === 'USDT-BEP20') {
    return 'BEP20';
  }

  return normalized;
}

export function buildExplorerLink(
  baseUrl: string | null | undefined,
  value: string | null | undefined,
): string | null {
  const normalizedBaseUrl = baseUrl?.trim();
  const normalizedValue = value?.trim();

  if (!normalizedBaseUrl || !normalizedValue) {
    return null;
  }

  if (normalizedBaseUrl.includes('{address}')) {
    return normalizedBaseUrl.replaceAll('{address}', normalizedValue);
  }

  if (normalizedBaseUrl.includes('{txHash}')) {
    return normalizedBaseUrl.replaceAll('{txHash}', normalizedValue);
  }

  return `${normalizedBaseUrl}${normalizedValue}`;
}
