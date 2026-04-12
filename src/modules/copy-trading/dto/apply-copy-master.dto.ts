import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class ApplyCopyMasterDto {
  @IsString()
  @MaxLength(64)
  displayName!: string;

  @IsNumber()
  @Min(0)
  performanceFeePercent!: number;

  @IsNumber()
  @Min(0)
  minFollowerBalance!: number;
}
