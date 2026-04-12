import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadKycFileDto {
  @IsString()
  @MaxLength(64)
  kind!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}
