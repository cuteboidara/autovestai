import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TransactionDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
