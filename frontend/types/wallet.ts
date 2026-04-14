export type WalletNetwork = 'TRC20' | 'ERC20'
export type AlphaWalletNetwork = WalletNetwork
export type SupportedDepositNetwork =
  | WalletNetwork
  | 'USDT-TRC20'
  | 'USDT-ERC20'

export interface WalletSummary {
  id: string
  userId: string
  type: 'LIVE' | 'DEMO'
  name: string
  accountNo: string
  balance: number
  balanceAsset: 'USDT'
  currency: string
  lockedMargin: number
  usedMargin: number
  unrealizedPnl: number
  equity: number
  freeMargin: number
  marginLevel: number | null
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
  isDefault: boolean
  walletId?: string
  openPositions?: number
  createdAt?: string
  updatedAt?: string
}

export interface WalletTransaction {
  id: string
  userId: string
  walletId?: string | null
  accountId?: string | null
  type: 'DEPOSIT' | 'WITHDRAW' | 'TRADE'
  amount: number
  asset: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
  reference?: string | null
  metadata?: Record<string, unknown> | null
  approvedById?: string | null
  approvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface WalletSnapshotResponse {
  wallet: WalletSummary
  transactions: WalletTransaction[]
  activeAccountId?: string
}

export interface DepositAddressResponse {
  address: string
  asset: 'USDT'
  network: WalletNetwork
  displayNetwork?: string
  memo?: string | null
  qrCode: string
}

export interface WalletDeposit {
  id: string
  userId: string
  accountId: string
  txHash?: string | null
  network?: WalletNetwork | null
  amount: number
  usdtAmount: number
  fromAddress?: string | null
  toAddress?: string | null
  confirmations: number
  status: 'PENDING' | 'CONFIRMING' | 'COMPLETED' | 'FAILED'
  creditedAt?: string | null
  approvalStatus?: WalletTransaction['status'] | null
  createdAt: string
}

export interface WithdrawalRequestRecord {
  id: string
  userId: string
  accountId: string
  amount: number
  fee: number
  netAmount: number
  network: WalletNetwork
  toAddress: string
  status: 'PENDING' | 'APPROVED' | 'SENT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
  adminNote?: string | null
  txHash?: string | null
  reviewedById?: string | null
  reviewedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface DepositRequest {
  amount: number
  asset?: 'USDT'
  reference?: string
  network?: SupportedDepositNetwork
  transactionHash?: string
  platformWalletId?: string
  depositAddress?: string
}

export interface WithdrawRequest {
  amount: number
  asset?: 'USDT'
  address: string
  reference?: string
  network?: SupportedDepositNetwork
}

export interface PlatformDepositWallet {
  id: string
  network: string
  coin: string
  address: string
  label?: string | null
  isActive: boolean
  minDeposit: number
  createdAt: string
  updatedAt: string
  source?: 'database' | 'environment'
  envKey?: string | null
}
