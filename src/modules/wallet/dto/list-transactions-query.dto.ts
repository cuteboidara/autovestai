import { Transform } from 'class-transformer';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListTransactionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @Transform(({ value }) => String(value).toLowerCase())
  @IsString()
  @MaxLength(255)
  userId?: string;
}
