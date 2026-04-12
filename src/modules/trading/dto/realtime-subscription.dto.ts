import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RealtimeSubscriptionDto {
  @IsIn([
    'subscribe_price',
    'subscribe_candles',
    'unsubscribe_price',
    'unsubscribe_candles',
  ])
  type!: 'subscribe_price' | 'subscribe_candles' | 'unsubscribe_price' | 'unsubscribe_candles';

  @Transform(({ value }) => String(value).toUpperCase())
  @IsString()
  @MaxLength(32)
  symbol!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  resolution?: string;
}

export class RealtimeChannelRequestDto {
  @Transform(({ value }) => String(value).toUpperCase())
  @IsString()
  @MaxLength(32)
  symbol!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  resolution?: string;
}
