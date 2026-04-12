import { Transform } from 'class-transformer';
import { CopyAllocationType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class UpdateCopyFollowDto {
  @IsOptional()
  @IsEnum(CopyAllocationType)
  allocationType?: CopyAllocationType;

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  allocationValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAllocation?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxOpenTrades?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slippageTolerance?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((entry) => String(entry).toUpperCase()) : [],
  )
  symbolWhitelist?: string[];

  @IsOptional()
  @IsArray()
  @Transform(({ value }) =>
    Array.isArray(value) ? value.map((entry) => String(entry).toUpperCase()) : [],
  )
  symbolBlacklist?: string[];
}
