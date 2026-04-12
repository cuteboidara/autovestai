export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  wsUrl: process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000',
  adminPath: process.env.NEXT_PUBLIC_ADMIN_PATH ?? 'control-tower',
  depositAddresses: {
    'USDT-TRC20': process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS_USDT_TRC20 ?? '',
    'USDT-ERC20': process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS_USDT_ERC20 ?? '',
    'BTC-BTC': process.env.NEXT_PUBLIC_DEPOSIT_ADDRESS_BTC_BTC ?? '',
  },
};
