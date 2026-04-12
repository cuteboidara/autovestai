import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListAuditLogsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  action?: string;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
