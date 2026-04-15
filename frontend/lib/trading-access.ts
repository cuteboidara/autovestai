import { getUserKycStatus } from '@/lib/kyc-access';
import { AuthUser } from '@/types/auth';
import { WalletSummary } from '@/types/wallet';

export interface TradingAction {
  href: string;
  label: string;
}

export interface TradingAvailability {
  canTrade: boolean;
  requiresKyc: boolean;
  requiresFunding: boolean;
  message: string | null;
  actions: TradingAction[];
}

export function getActiveAccountLabel(
  user?: AuthUser | null,
  wallet?: WalletSummary | null,
): string {
  if (wallet?.name && wallet?.accountNo) {
    return `${wallet.name} ${wallet.accountNo}`;
  }

  if (wallet?.accountNo) {
    return wallet.accountNo;
  }

  if (wallet?.id) {
    return `Acct ${wallet.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  if (user?.id) {
    return `Acct ${user.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  return 'Trading Account';
}

export function getTradingAvailability(
  user?: AuthUser | null,
  wallet?: WalletSummary | null,
): TradingAvailability {
  if (wallet?.status === 'SUSPENDED') {
    return {
      canTrade: false,
      requiresKyc: false,
      requiresFunding: false,
      message: 'Trading is unavailable because the selected account is suspended.',
      actions: [{ href: '/accounts', label: 'Review Accounts' }],
    };
  }

  if (wallet?.status === 'CLOSED') {
    return {
      canTrade: false,
      requiresKyc: false,
      requiresFunding: false,
      message: 'Trading is unavailable because the selected account is closed.',
      actions: [{ href: '/accounts', label: 'Open Account' }],
    };
  }

  if (wallet?.type === 'DEMO') {
    return {
      canTrade: true,
      requiresKyc: false,
      requiresFunding: false,
      message: null,
      actions: [],
    };
  }

  const requiresKyc =
    Boolean(user) &&
    user?.role !== 'ADMIN' &&
    getUserKycStatus(user) !== 'APPROVED';
  const requiresFunding = Boolean(wallet) && (wallet?.equity ?? wallet?.balance ?? 0) <= 0;
  const canTrade = !requiresKyc && !requiresFunding;
  const actions: TradingAction[] = [];

  if (requiresFunding) {
    actions.push({ href: '/wallet?tab=deposit', label: 'Deposit' });
  }

  if (requiresKyc) {
    actions.push({ href: '/kyc', label: 'Complete KYC' });
  }

  return {
    canTrade,
    requiresKyc,
    requiresFunding,
    message: canTrade
      ? null
      : 'Trading is currently unavailable. Please complete verification or fund your account.',
    actions,
  };
}
