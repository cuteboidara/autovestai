import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTreasuryBalanceSnapshotDto {
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? value : Number(value),
  )
  @IsNumber()
  @Min(0)
  balance!: number;

  @IsOptional()
  @IsDateString()
  observedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceNote?: string;
}
