import { Transform } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export enum ProviderSortBy {
  BEST_RETURN = 'BEST_RETURN',
  MOST_COPIERS = 'MOST_COPIERS',
  LOWEST_DRAWDOWN = 'LOWEST_DRAWDOWN',
  NEWEST = 'NEWEST',
}

export class ListSignalProvidersQueryDto {
  @IsOptional()
  @IsEnum(ProviderSortBy)
  sortBy?: ProviderSortBy;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsNumber()
  minReturn?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
  @IsNumber()
  @Min(0)
  maxDrawdown?: number;
}
