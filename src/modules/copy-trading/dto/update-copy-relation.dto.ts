import { CopyStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCopyRelationDto {
  @IsOptional()
  @IsNumber()
  @Min(0.00000001)
  allocatedAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(5)
  copyRatio?: number;

  @IsOptional()
  @IsEnum(CopyStatus)
  status?: CopyStatus;
}
