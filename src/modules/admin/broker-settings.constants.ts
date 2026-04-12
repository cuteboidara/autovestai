export interface BrokerFeatureSettings {
  tradingEnabled: boolean;
  registrationsEnabled: boolean;
  withdrawalsEnabled: boolean;
  copyTradingEnabled: boolean;
  affiliateProgramEnabled: boolean;
  affiliatePayoutsEnabled: boolean;
  maintenanceModeEnabled: boolean;
  maintenanceMessage: string;
}

export interface BrokerSymbolConfig {
  symbol: string;
  maxLeverage: number;
  spreadMarkup: number;
  tradingEnabled: boolean;
  maxExposureThreshold: number;
}

export interface AffiliateLevelRates {
  level1Percent: number;
  level2Percent: number;
  level3Percent: number;
}

export interface TreasuryWalletSettings {
  network: 'TRC20' | 'ERC20';
  masterWalletTrc20: string | null;
  masterWalletErc20: string | null;
  masterWalletAddress: string | null;
}

export const BROKER_SETTINGS_KEYS = {
  tradingEnabled: 'features.tradingEnabled',
  registrationsEnabled: 'features.registrationsEnabled',
  withdrawalsEnabled: 'features.withdrawalsEnabled',
  copyTradingEnabled: 'features.copyTradingEnabled',
  affiliateProgramEnabled: 'features.affiliateProgramEnabled',
  affiliatePayoutsEnabled: 'features.affiliatePayoutsEnabled',
  maintenanceModeEnabled: 'features.maintenanceModeEnabled',
  maintenanceMessage: 'features.maintenanceMessage',
  affiliateLevel1Percent: 'affiliate.level1Percent',
  affiliateLevel2Percent: 'affiliate.level2Percent',
  affiliateLevel3Percent: 'affiliate.level3Percent',
  masterWalletTrc20: 'treasury.masterWalletTrc20',
  masterWalletErc20: 'treasury.masterWalletErc20',
} as const;

export const DEFAULT_BROKER_FEATURE_SETTINGS: BrokerFeatureSettings = {
  tradingEnabled: true,
  registrationsEnabled: true,
  withdrawalsEnabled: true,
  copyTradingEnabled: true,
  affiliateProgramEnabled: true,
  affiliatePayoutsEnabled: true,
  maintenanceModeEnabled: false,
  maintenanceMessage: 'Scheduled maintenance in progress. Trading and operations may be limited.',
};

export const DEFAULT_AFFILIATE_LEVEL_RATES: AffiliateLevelRates = {
  level1Percent: 30,
  level2Percent: 10,
  level3Percent: 5,
};
