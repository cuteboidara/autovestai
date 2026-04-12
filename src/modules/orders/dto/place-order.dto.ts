import { Transform } from 'class-transformer';
import { OrderSide, OrderType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PlaceOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  clientRequestId?: string;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsString()
  @MaxLength(64)
  @Transform(({ value }) => String(value).toUpperCase())
  symbol!: string;

  @IsNumber()
  @Min(0.00000001)
  volume!: number;

  @IsNumber()
  @Min(1)
  leverage!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  stopLoss?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  takeProfit?: number;
}
