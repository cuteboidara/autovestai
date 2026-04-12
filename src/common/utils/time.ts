export function parseDurationToMilliseconds(value: string): number {
  const match = value.trim().match(/^(\d+)([smhd])$/i);

  if (!match) {
    throw new Error(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return amount * multipliers[unit];
}
