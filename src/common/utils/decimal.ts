import { Prisma } from '@prisma/client';

export function toDecimal(
  value: Prisma.Decimal | Prisma.DecimalJsLike | number | string,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  return new Prisma.Decimal(value as string | number | Prisma.Decimal);
}

export function zeroDecimal(): Prisma.Decimal {
  return new Prisma.Decimal(0);
}

export function toNumber(
  value: Prisma.Decimal | number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  return value.toNumber();
}

export function roundTo(value: number, scale = 8): number {
  return Number(value.toFixed(scale));
}
