import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class RegisterSignalProviderDto {
  @IsString()
  @MaxLength(64)
  accountId!: string;

  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => String(value).trim())
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  bio?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  strategy?: string;

  @IsNumber()
  @Min(0.00000001)
  minCopyAmount!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent!: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isAccepting?: boolean;
}
