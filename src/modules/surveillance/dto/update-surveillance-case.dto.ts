import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SurveillanceCaseStatus } from '@prisma/client';

export class UpdateSurveillanceCaseDto {
  @IsOptional()
  @IsEnum(SurveillanceCaseStatus)
  status?: SurveillanceCaseStatus;

  @IsOptional()
  notesJson?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToUserId?: string;
}
