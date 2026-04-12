import {
  ReconciliationRunSource,
  ReconciliationStatus,
} from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class ListReconciliationRunsQueryDto {
  @IsOptional()
  @IsEnum(ReconciliationStatus)
  status?: ReconciliationStatus;

  @IsOptional()
  @IsEnum(ReconciliationRunSource)
  source?: ReconciliationRunSource;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
