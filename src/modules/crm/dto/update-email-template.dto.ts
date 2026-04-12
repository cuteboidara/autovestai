import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  body?: string;
}
