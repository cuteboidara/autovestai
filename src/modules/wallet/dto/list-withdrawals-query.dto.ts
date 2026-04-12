import { WithdrawalStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListWithdrawalsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;
}
