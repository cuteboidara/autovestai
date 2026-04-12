import { IsOptional, IsString, MaxLength } from 'class-validator';

export class KycDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
