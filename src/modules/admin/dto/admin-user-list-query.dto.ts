import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUserListQueryDto {
  @IsOptional()
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @MaxLength(255)
  search?: string;
}
