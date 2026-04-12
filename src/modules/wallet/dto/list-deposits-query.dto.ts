import { DepositStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListDepositsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsEnum(DepositStatus)
  status?: DepositStatus;
}
