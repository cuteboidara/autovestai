import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEmailSenderConfigDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  fromEmail!: string;

  @IsString()
  @MaxLength(255)
  smtpHost!: string;

  @IsInt()
  @Min(1)
  smtpPort!: number;

  @IsString()
  @MaxLength(255)
  smtpUser!: string;

  @IsString()
  @MaxLength(255)
  smtpPass!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
