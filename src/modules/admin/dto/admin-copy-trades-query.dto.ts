import { CopyTradeStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class AdminCopyTradesQueryDto {
  @IsOptional()
  @IsEnum(CopyTradeStatus)
  status?: CopyTradeStatus;
}
