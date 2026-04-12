import { IsOptional, IsString, MaxLength } from 'class-validator';

export class HedgeActionDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
