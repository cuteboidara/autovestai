import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateEmailSenderConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  smtpPort?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpUser?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  smtpPass?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
