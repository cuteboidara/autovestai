import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendCrmEmailDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  userIds?: string[];

  @IsOptional()
  @IsBoolean()
  allClients?: boolean;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsString()
  senderConfigId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  body?: string;
}
