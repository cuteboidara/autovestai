import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitKycDto {
  @IsString()
  @MaxLength(128)
  fullName!: string;

  @IsString()
  @MaxLength(32)
  dateOfBirth!: string;

  @IsString()
  @MaxLength(64)
  country!: string;

  @IsString()
  @MaxLength(255)
  addressLine1!: string;

  @IsString()
  @MaxLength(128)
  city!: string;

  @IsString()
  @MaxLength(32)
  postalCode!: string;

  @IsString()
  @MaxLength(64)
  documentType!: string;

  @IsString()
  @MaxLength(64)
  documentNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentFrontUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentBackUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  selfieUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  proofOfAddressUrl?: string;
}
