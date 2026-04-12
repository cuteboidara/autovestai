import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveEmailTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100_000)
  body!: string;
}
