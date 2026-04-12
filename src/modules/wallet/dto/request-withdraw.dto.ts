import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

import {
  ALPHA_WALLET_ASSET,
  SUPPORTED_DEPOSIT_NETWORKS,
} from '../wallet.constants';

export class RequestWithdrawDto {
  @IsNumber()
  @Min(0.00000001)
  amount!: number;

  @IsOptional()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @MaxLength(16)
  @IsIn([ALPHA_WALLET_ASSET])
  asset?: string;

  @IsString()
  @MaxLength(255)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @IsOptional()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @MaxLength(32)
  @IsIn(SUPPORTED_DEPOSIT_NETWORKS)
  network?: string;
}
