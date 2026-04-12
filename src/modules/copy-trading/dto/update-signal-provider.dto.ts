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

export class UpdateSignalProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName?: string;

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

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  minCopyAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  feePercent?: number;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isAccepting?: boolean;
}
