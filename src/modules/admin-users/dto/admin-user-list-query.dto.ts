import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUserListQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
