import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkWithdrawalSentDto {
  @IsString()
  @MaxLength(255)
  txHash!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}
