import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { SymbolsService } from '../symbols/symbols.service';
import {
  AffiliateLevelRates,
  BROKER_SETTINGS_KEYS,
  BrokerFeatureSettings,
  BrokerSymbolConfig,
  DEFAULT_AFFILIATE_LEVEL_RATES,
  DEFAULT_BROKER_FEATURE_SETTINGS,
} from './broker-settings.constants';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { UpdateSymbolConfigDto } from './dto/update-symbol-config.dto';

@Injectable()
export class BrokerSettingsService implements OnModuleInit {
  private readonly cache = new Map<string, Prisma.JsonValue>();

  constructor(
    private readonly prismaService: PrismaService,
    private readonly symbolsService: SymbolsService,
  ) {
    this.seedDefaultCache();
  }

  async onModuleInit(): Promise<void> {
    await this.symbolsService.reload();
    await this.ensureDefaultsPersisted();
    await this.loadCacheFromDatabase();
  }

  getFeatureSettings(): BrokerFeatureSettings {
    return {
      tradingEnabled: this.getBooleanValue(
        BROKER_SETTINGS_KEYS.tradingEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.tradingEnabled,
      ),
      registrationsEnabled: this.getBooleanValue(
        BROKER_SETTINGS_KEYS.registrationsEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.registrationsEnabled,
      ),
      withdrawalsEnabled: this.getBooleanValue(
        BROKER_SETTINGS_KEYS.withdrawalsEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.withdrawalsEnabled,
      ),
      copyTradingEnabled: this.getBooleanValue(
        BROKER_SETTINGS_KEYS.copyTradingEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.copyTradingEnabled,
      ),
      affiliateProgramEnabled: this.getBooleanValue(
        BROKER_SETTINGS_KEYS.affiliateProgramEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.affiliateProgramEnabled,
      ),
      affiliatePayoutsEnabled: this.getBooleanValue(
        BROKER_SETTINGS_KEYS.affiliatePayoutsEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.affiliatePayoutsEnabled,
      ),
      maintenanceModeEnabled: this.getBooleanValue(
        BROKER_SETTINGS_KEYS.maintenanceModeEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.maintenanceModeEnabled,
      ),
      maintenanceMessage: this.getStringValue(
        BROKER_SETTINGS_KEYS.maintenanceMessage,
        DEFAULT_BROKER_FEATURE_SETTINGS.maintenanceMessage,
      ),
    };
  }

  getAffiliateLevelRates(): AffiliateLevelRates {
    return {
      level1Percent: this.getNumberValue(
        BROKER_SETTINGS_KEYS.affiliateLevel1Percent,
        DEFAULT_AFFILIATE_LEVEL_RATES.level1Percent,
      ),
      level2Percent: this.getNumberValue(
        BROKER_SETTINGS_KEYS.affiliateLevel2Percent,
        DEFAULT_AFFILIATE_LEVEL_RATES.level2Percent,
      ),
      level3Percent: this.getNumberValue(
        BROKER_SETTINGS_KEYS.affiliateLevel3Percent,
        DEFAULT_AFFILIATE_LEVEL_RATES.level3Percent,
      ),
    };
  }

  isCopyTradingEnabled(): boolean {
    return this.getFeatureSettings().copyTradingEnabled;
  }

  isTradingEnabled(): boolean {
    return this.getFeatureSettings().tradingEnabled;
  }

  areRegistrationsEnabled(): boolean {
    return this.getFeatureSettings().registrationsEnabled;
  }

  areWithdrawalsEnabled(): boolean {
    return this.getFeatureSettings().withdrawalsEnabled;
  }

  isAffiliateProgramEnabled(): boolean {
    return this.getFeatureSettings().affiliateProgramEnabled;
  }

  areAffiliatePayoutsEnabled(): boolean {
    return this.getFeatureSettings().affiliatePayoutsEnabled;
  }

  getPublicPlatformStatus() {
    const features = this.getFeatureSettings();

    return {
      maintenanceModeEnabled: features.maintenanceModeEnabled,
      maintenanceMessage: features.maintenanceMessage,
      features: {
        tradingEnabled: features.tradingEnabled,
        registrationsEnabled: features.registrationsEnabled,
        withdrawalsEnabled: features.withdrawalsEnabled,
        copyTradingEnabled: features.copyTradingEnabled,
        affiliateProgramEnabled: features.affiliateProgramEnabled,
        affiliatePayoutsEnabled: features.affiliatePayoutsEnabled,
      },
    };
  }

  getSymbolConfig(symbol: string): BrokerSymbolConfig {
    const instrument = this.symbolsService.getSymbolOrThrow(symbol);
    const normalized = instrument.symbol;
    const defaults = this.getDefaultSymbolConfig(instrument);

    return {
      symbol: normalized,
      maxLeverage: this.getNumberValue(
        this.getSymbolKey(normalized, 'maxLeverage'),
        defaults.maxLeverage,
      ),
      spreadMarkup: this.getNumberValue(
        this.getSymbolKey(normalized, 'spreadMarkup'),
        defaults.spreadMarkup,
      ),
      tradingEnabled: this.getBooleanValue(
        this.getSymbolKey(normalized, 'tradingEnabled'),
        defaults.tradingEnabled,
      ),
      maxExposureThreshold: this.getNumberValue(
        this.getSymbolKey(normalized, 'maxExposureThreshold'),
        defaults.maxExposureThreshold,
      ),
    };
  }

  getAllSymbolConfigs(): BrokerSymbolConfig[] {
    return this.symbolsService.listSymbols().map((symbol) => this.getSymbolConfig(symbol.symbol));
  }

  async getSettingsSummary() {
    return {
      features: this.getFeatureSettings(),
      affiliateLevels: this.getAffiliateLevelRates(),
    };
  }

  async updateSettings(dto: UpdateAdminSettingsDto) {
    const operations: Array<Promise<void>> = [];

    if (dto.tradingEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.tradingEnabled,
          dto.tradingEnabled,
        ),
      );
    }

    if (dto.registrationsEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.registrationsEnabled,
          dto.registrationsEnabled,
        ),
      );
    }

    if (dto.withdrawalsEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.withdrawalsEnabled,
          dto.withdrawalsEnabled,
        ),
      );
    }

    if (dto.copyTradingEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.copyTradingEnabled,
          dto.copyTradingEnabled,
        ),
      );
    }

    if (dto.affiliateProgramEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.affiliateProgramEnabled,
          dto.affiliateProgramEnabled,
        ),
      );
    }

    if (dto.affiliatePayoutsEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.affiliatePayoutsEnabled,
          dto.affiliatePayoutsEnabled,
        ),
      );
    }

    if (dto.maintenanceModeEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.maintenanceModeEnabled,
          dto.maintenanceModeEnabled,
        ),
      );
    }

    if (dto.maintenanceMessage !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.maintenanceMessage,
          dto.maintenanceMessage.trim() || DEFAULT_BROKER_FEATURE_SETTINGS.maintenanceMessage,
        ),
      );
    }

    if (dto.level1Percent !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.affiliateLevel1Percent,
          dto.level1Percent,
        ),
      );
    }

    if (dto.level2Percent !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.affiliateLevel2Percent,
          dto.level2Percent,
        ),
      );
    }

    if (dto.level3Percent !== undefined) {
      operations.push(
        this.setSettingValue(
          BROKER_SETTINGS_KEYS.affiliateLevel3Percent,
          dto.level3Percent,
        ),
      );
    }

    await Promise.all(operations);
    return this.getSettingsSummary();
  }

  async updateSymbolConfig(symbol: string, dto: UpdateSymbolConfigDto) {
    const normalized = this.symbolsService.getSymbolOrThrow(symbol).symbol;
    const operations: Array<Promise<void>> = [];

    if (dto.maxLeverage !== undefined) {
      operations.push(
        this.setSettingValue(this.getSymbolKey(normalized, 'maxLeverage'), dto.maxLeverage),
      );
    }

    if (dto.spreadMarkup !== undefined) {
      operations.push(
        this.setSettingValue(this.getSymbolKey(normalized, 'spreadMarkup'), dto.spreadMarkup),
      );
    }

    if (dto.tradingEnabled !== undefined) {
      operations.push(
        this.setSettingValue(
          this.getSymbolKey(normalized, 'tradingEnabled'),
          dto.tradingEnabled,
        ),
      );
    }

    if (dto.maxExposureThreshold !== undefined) {
      operations.push(
        this.setSettingValue(
          this.getSymbolKey(normalized, 'maxExposureThreshold'),
          dto.maxExposureThreshold,
        ),
      );
    }

    await Promise.all(operations);
    return this.getSymbolConfig(normalized);
  }

  private async ensureDefaultsPersisted(): Promise<void> {
    const defaultEntries: Array<[string, Prisma.InputJsonValue]> = [
      [
        BROKER_SETTINGS_KEYS.tradingEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.tradingEnabled,
      ],
      [
        BROKER_SETTINGS_KEYS.registrationsEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.registrationsEnabled,
      ],
      [
        BROKER_SETTINGS_KEYS.withdrawalsEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.withdrawalsEnabled,
      ],
      [
        BROKER_SETTINGS_KEYS.copyTradingEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.copyTradingEnabled,
      ],
      [
        BROKER_SETTINGS_KEYS.affiliateProgramEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.affiliateProgramEnabled,
      ],
      [
        BROKER_SETTINGS_KEYS.affiliatePayoutsEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.affiliatePayoutsEnabled,
      ],
      [
        BROKER_SETTINGS_KEYS.maintenanceModeEnabled,
        DEFAULT_BROKER_FEATURE_SETTINGS.maintenanceModeEnabled,
      ],
      [
        BROKER_SETTINGS_KEYS.maintenanceMessage,
        DEFAULT_BROKER_FEATURE_SETTINGS.maintenanceMessage,
      ],
      [
        BROKER_SETTINGS_KEYS.affiliateLevel1Percent,
        DEFAULT_AFFILIATE_LEVEL_RATES.level1Percent,
      ],
      [
        BROKER_SETTINGS_KEYS.affiliateLevel2Percent,
        DEFAULT_AFFILIATE_LEVEL_RATES.level2Percent,
      ],
      [
        BROKER_SETTINGS_KEYS.affiliateLevel3Percent,
        DEFAULT_AFFILIATE_LEVEL_RATES.level3Percent,
      ],
      ...this.symbolsService.listSymbols().flatMap((symbol) => {
        const defaults = this.getDefaultSymbolConfig(symbol);

        return [
          [this.getSymbolKey(symbol.symbol, 'maxLeverage'), defaults.maxLeverage],
          [this.getSymbolKey(symbol.symbol, 'spreadMarkup'), defaults.spreadMarkup],
          [this.getSymbolKey(symbol.symbol, 'tradingEnabled'), defaults.tradingEnabled],
          [
            this.getSymbolKey(symbol.symbol, 'maxExposureThreshold'),
            defaults.maxExposureThreshold,
          ],
        ] satisfies Array<[string, Prisma.InputJsonValue]>;
      }),
    ];

    await Promise.all(
      defaultEntries.map(([key, value]) =>
        this.prismaService.brokerSetting.upsert({
          where: { key },
          create: {
            key,
            value,
          },
          update: {},
        }),
      ),
    );
  }

  private async loadCacheFromDatabase(): Promise<void> {
    const settings = await this.prismaService.brokerSetting.findMany();

    for (const setting of settings) {
      this.cache.set(setting.key, setting.value);
    }
  }

  private async setSettingValue(key: string, value: Prisma.InputJsonValue): Promise<void> {
    const updated = await this.prismaService.brokerSetting.upsert({
      where: { key },
      create: {
        key,
        value,
      },
      update: {
        value,
      },
    });

    this.cache.set(updated.key, updated.value);
  }

  private getNumberValue(key: string, fallback: number): number {
    const value = this.cache.get(key);

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    return fallback;
  }

  private getBooleanValue(key: string, fallback: boolean): boolean {
    const value = this.cache.get(key);

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      if (value === 'true') {
        return true;
      }

      if (value === 'false') {
        return false;
      }
    }

    return fallback;
  }

  private getStringValue(key: string, fallback: string): string {
    const value = this.cache.get(key);

    if (typeof value === 'string') {
      return value;
    }

    return fallback;
  }

  private getSymbolKey(
    symbol: string,
    field: keyof Omit<BrokerSymbolConfig, 'symbol'>,
  ): string {
    return `symbol.${symbol}.${field}`;
  }

  private seedDefaultCache(): void {
    this.cache.set(
      BROKER_SETTINGS_KEYS.tradingEnabled,
      DEFAULT_BROKER_FEATURE_SETTINGS.tradingEnabled,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.registrationsEnabled,
      DEFAULT_BROKER_FEATURE_SETTINGS.registrationsEnabled,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.withdrawalsEnabled,
      DEFAULT_BROKER_FEATURE_SETTINGS.withdrawalsEnabled,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.copyTradingEnabled,
      DEFAULT_BROKER_FEATURE_SETTINGS.copyTradingEnabled,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.affiliateProgramEnabled,
      DEFAULT_BROKER_FEATURE_SETTINGS.affiliateProgramEnabled,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.affiliatePayoutsEnabled,
      DEFAULT_BROKER_FEATURE_SETTINGS.affiliatePayoutsEnabled,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.maintenanceModeEnabled,
      DEFAULT_BROKER_FEATURE_SETTINGS.maintenanceModeEnabled,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.maintenanceMessage,
      DEFAULT_BROKER_FEATURE_SETTINGS.maintenanceMessage,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.affiliateLevel1Percent,
      DEFAULT_AFFILIATE_LEVEL_RATES.level1Percent,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.affiliateLevel2Percent,
      DEFAULT_AFFILIATE_LEVEL_RATES.level2Percent,
    );
    this.cache.set(
      BROKER_SETTINGS_KEYS.affiliateLevel3Percent,
      DEFAULT_AFFILIATE_LEVEL_RATES.level3Percent,
    );
  }

  private getDefaultSymbolConfig(symbol: {
    symbol: string;
    isActive: boolean;
  }): BrokerSymbolConfig {
    const instrument = this.symbolsService.getSymbolOrThrow(symbol.symbol);

    return {
      symbol: instrument.symbol,
      maxLeverage: this.symbolsService.getDefaultMaxLeverage(instrument),
      spreadMarkup: 0,
      tradingEnabled: instrument.isActive,
      maxExposureThreshold: this.symbolsService.getDefaultExposureThreshold(instrument),
    };
  }
}
