import { Transform } from 'class-transformer';
import { CopyAllocationType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class FollowCopyMasterDto {
  @IsString()
  @MaxLength(64)
  masterId!: string;

  @IsEnum(CopyAllocationType)
  allocationType!: CopyAllocationType;

  @IsNumber()
  @Min(0.00000001)
  allocationValue!: number;

  @IsNumber()
  @Min(0)
  maxAllocation!: number;

  @IsNumber()
  @Min(1)
  maxOpenTrades!: number;

  @IsNumber()
  @Min(0)
  slippageTolerance!: number;

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
