import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListTreasuryBalanceSnapshotsQueryDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === '' ? value : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
