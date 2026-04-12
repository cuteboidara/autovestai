import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateSymbolConfigDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxLeverage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  spreadMarkup?: number;

  @IsOptional()
  @IsBoolean()
  tradingEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxExposureThreshold?: number;
}
