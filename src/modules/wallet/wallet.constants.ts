export const WALLET_NETWORKS = ['TRC20', 'ERC20'] as const;

export type WalletNetwork = (typeof WALLET_NETWORKS)[number];

export const WALLET_NETWORK_INPUTS = [
  'TRC20',
  'ERC20',
  'USDT-TRC20',
  'USDT-ERC20',
] as const;

export type SupportedDepositNetwork = (typeof WALLET_NETWORK_INPUTS)[number];
export type AlphaWalletNetwork = WalletNetwork;

export const ALPHA_WALLET_ASSET = 'USDT' as const;
export const SUPPORTED_ALPHA_WALLET_NETWORKS = WALLET_NETWORKS;
export const SUPPORTED_DEPOSIT_NETWORKS = WALLET_NETWORK_INPUTS;

export const NETWORK_ALIAS_MAP: Record<string, WalletNetwork> = {
  TRC20: 'TRC20',
  ERC20: 'ERC20',
  'USDT-TRC20': 'TRC20',
  'USDT-ERC20': 'ERC20',
};

export const NETWORK_LABEL_MAP: Record<WalletNetwork, string> = {
  TRC20: 'USDT-TRC20',
  ERC20: 'USDT-ERC20',
};

export const NETWORK_ASSET_MAP: Record<WalletNetwork, string> = {
  TRC20: 'USDT',
  ERC20: 'USDT',
};

export const NETWORK_DISPLAY_NAME_MAP: Record<WalletNetwork, string> = {
  TRC20: 'TRON (TRC20)',
  ERC20: 'Ethereum (ERC20)',
};

export const NETWORK_EXPLORER_BASES: Record<WalletNetwork, string> = {
  TRC20: 'https://tronscan.org/#/transaction/',
  ERC20: 'https://etherscan.io/tx/',
};

export const NETWORK_CONFIRMATIONS_REQUIRED: Record<WalletNetwork, number> = {
  TRC20: 1,
  ERC20: 12,
};

export const NETWORK_MINIMUM_DEPOSIT: Record<WalletNetwork, number> = {
  TRC20: 10,
  ERC20: 10,
};

export const NETWORK_WITHDRAWAL_FEE: Record<WalletNetwork, number> = {
  TRC20: 2,
  ERC20: 2,
};

export const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const ETH_USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

export function normalizeWalletNetwork(network: string): WalletNetwork {
  const normalized = network.trim().toUpperCase();
  const mapped = NETWORK_ALIAS_MAP[normalized];

  if (!mapped) {
    throw new Error(`Unsupported deposit network: ${network}`);
  }

  return mapped;
}
