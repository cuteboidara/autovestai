import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CopyMasterDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
