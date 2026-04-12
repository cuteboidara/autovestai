import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SurveillanceAlertStatus, SurveillanceSeverity } from '@prisma/client';

export class ListSurveillanceAlertsQueryDto {
  @IsOptional()
  @IsEnum(SurveillanceAlertStatus)
  status?: SurveillanceAlertStatus;

  @IsOptional()
  @IsEnum(SurveillanceSeverity)
  severity?: SurveillanceSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  symbol?: string;
}
