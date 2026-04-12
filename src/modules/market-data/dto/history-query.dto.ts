import { Transform } from 'class-transformer';
import { IsNumberString, IsString, MaxLength } from 'class-validator';

export class HistoryQueryDto {
  @Transform(({ value }) => String(value).toUpperCase())
  @IsString()
  @MaxLength(32)
  symbol!: string;

  @IsString()
  @MaxLength(8)
  resolution!: string;

  @IsNumberString()
  from!: string;

  @IsNumberString()
  to!: string;
}
