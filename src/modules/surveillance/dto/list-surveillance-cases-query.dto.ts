import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SurveillanceCaseStatus } from '@prisma/client';

export class ListSurveillanceCasesQueryDto {
  @IsOptional()
  @IsEnum(SurveillanceCaseStatus)
  status?: SurveillanceCaseStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToUserId?: string;
}
