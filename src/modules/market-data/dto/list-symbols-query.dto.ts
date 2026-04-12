import { Transform } from 'class-transformer';
import { SymbolCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

function toOptionalBoolean(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return undefined;
}

export class ListSymbolsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(SymbolCategory)
  @Transform(({ value }) => (value ? String(value).trim().toUpperCase() : undefined))
  assetClass?: SymbolCategory;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  enabledOnly?: boolean;
}
