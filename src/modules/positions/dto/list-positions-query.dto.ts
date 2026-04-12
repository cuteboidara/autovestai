import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum PositionListStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  ALL = 'ALL',
}

export class ListPositionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountId?: string;

  // FIX: The terminal needs both open and closed positions on initial load.
  @IsOptional()
  @IsEnum(PositionListStatus)
  status?: PositionListStatus;
}
