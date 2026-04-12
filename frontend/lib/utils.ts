import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

function toFiniteNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatCurrency(value: number | string | null | undefined, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(toFiniteNumber(value));
}

export function formatUsdt(
  value: number | string | null | undefined,
  fractionDigits = 2,
): string {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toFiniteNumber(value))} USDT`;
}

export function formatNumber(
  value: number | string | null | undefined,
  fractionDigits = 2,
): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(toFiniteNumber(value));
}

export function formatPercentage(value: number | string | null | undefined): string {
  const numeric = toFiniteNumber(value);
  return `${numeric >= 0 ? '+' : ''}${formatNumber(numeric, 2)}%`;
}

export function formatDateTime(value: string | Date): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
