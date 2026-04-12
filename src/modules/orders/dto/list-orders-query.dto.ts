import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @Transform(({ value }) => String(value).toUpperCase())
  @IsString()
  @MaxLength(32)
  symbol?: string;
}
