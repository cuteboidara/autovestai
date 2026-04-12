import { AdminRole } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateAdminUserDto {
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
