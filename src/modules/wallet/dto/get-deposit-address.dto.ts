import { Transform } from 'class-transformer';
import { IsIn, IsString } from 'class-validator';

import { SUPPORTED_DEPOSIT_NETWORKS } from '../wallet.constants';

export class GetDepositAddressDto {
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsString()
  @IsIn(SUPPORTED_DEPOSIT_NETWORKS)
  network!: string;
}
