import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveComplaintDto {
  @IsEnum(['UPHELD', 'PARTIALLY_UPHELD', 'REJECTED'])
  decision!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  resolutionNote!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  compensation?: number;
}
