import { AccountType, KycStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListClientsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(KycStatus)
  kycStatus?: KycStatus;

  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsDateString()
  registeredFrom?: string;

  @IsOptional()
  @IsDateString()
  registeredTo?: string;

  @IsOptional()
  @IsEnum(['registration_date', 'balance', 'last_login'] as const)
  sortBy?: 'registration_date' | 'balance' | 'last_login';

  @IsOptional()
  @IsEnum(['asc', 'desc'] as const)
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
