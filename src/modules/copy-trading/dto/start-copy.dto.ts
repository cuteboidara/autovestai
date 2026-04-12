import { CopyStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class StartCopyDto {
  @IsString()
  copyAccountId!: string;

  @IsNumber()
  @Min(0.00000001)
  allocatedAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  copyRatio?: number;

  @IsOptional()
  @IsEnum(CopyStatus)
  status?: CopyStatus;
}
