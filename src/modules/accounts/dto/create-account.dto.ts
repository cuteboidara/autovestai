import { AccountType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAccountDto {
  @IsEnum(AccountType)
  type!: AccountType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
