import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyAffiliateDto {
  @IsOptional()
  @IsString()
  @MaxLength(24)
  referralCodePrefix?: string;
}
