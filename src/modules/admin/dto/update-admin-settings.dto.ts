import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateAdminSettingsDto {
  @IsOptional()
  @IsBoolean()
  tradingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  registrationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  withdrawalsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  copyTradingEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  affiliateProgramEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  affiliatePayoutsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceModeEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  maintenanceMessage?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  level1Percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  level2Percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  level3Percent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  masterWalletTrc20?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  masterWalletErc20?: string;
}
