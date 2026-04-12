import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSurveillanceCaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  alertId?: string;

  @IsOptional()
  notesJson?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToUserId?: string;
}
