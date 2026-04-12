import { AdminRole } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAdminUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsEnum(AdminRole)
  role!: AdminRole;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  temporaryPassword?: string;
}
