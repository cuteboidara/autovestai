'use client';

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { accountsApi } from '@/services/api/accounts';
import { walletApi } from '@/services/api/wallet';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';
import { useWalletStore } from '@/store/wallet-store';
import { AccountSummary, CreateAccountRequest } from '@/types/account';

interface CreateAccountOptions {
  activate?: boolean;
}

interface AccountContextValue {
  accounts: AccountSummary[];
  activeAccount: AccountSummary | null;
  activeAccountId: string | null;
  loading: boolean;
  switcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;
  refreshAccounts: () => Promise<AccountSummary[]>;
  setActiveAccount: (accountId: string) => Promise<AccountSummary>;
  createAccount: (
    payload: CreateAccountRequest,
    options?: CreateAccountOptions,
  ) => Promise<AccountSummary>;
  resetDemoAccount: (accountId: string) => Promise<AccountSummary>;
  closeAccount: (accountId: string) => Promise<void>;
}

const missingProviderError = new Error('AccountProvider is not mounted');

const AccountContext = createContext<AccountContextValue>({
  accounts: [],
  activeAccount: null,
  activeAccountId: null,
  loading: false,
  switcherOpen: false,
  setSwitcherOpen: () => undefined,
  refreshAccounts: async () => {
    throw missingProviderError;
  },
  setActiveAccount: async () => {
    throw missingProviderError;
  },
  createAccount: async () => {
    throw missingProviderError;
  },
  resetDemoAccount: async () => {
    throw missingProviderError;
  },
  closeAccount: async () => {
    throw missingProviderError;
  },
});

function sortAccounts(accounts: AccountSummary[]) {
  return [...accounts].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

function mergeWalletIntoAccounts(
  accounts: AccountSummary[],
  wallet: ReturnType<typeof useWalletStore.getState>['wallet'],
) {
  if (!wallet) {
    return accounts;
  }

  return sortAccounts(
    accounts.map((account) =>
      account.id === wallet.id
        ? {
            ...account,
            balance: wallet.balance,
            balanceAsset: wallet.balanceAsset,
            currency: wallet.currency,
            usedMargin: wallet.usedMargin,
            lockedMargin: wallet.lockedMargin,
            unrealizedPnl: wallet.unrealizedPnl,
            equity: wallet.equity,
            freeMargin: wallet.freeMargin,
            marginLevel: wallet.marginLevel,
            status: wallet.status,
            isDefault: wallet.isDefault,
            openPositions: wallet.openPositions ?? account.openPositions,
            updatedAt: wallet.updatedAt ?? account.updatedAt,
          }
        : wallet.isDefault
          ? {
              ...account,
              isDefault: false,
            }
          : account,
    ),
  );
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const userRole = useAuthStore((state) => state.user?.role);
  const wallet = useWalletStore((state) => state.wallet);
  const setWalletSnapshot = useWalletStore((state) => state.setSnapshot);
  const pushNotification = useNotificationStore((state) => state.push);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  async function refreshWalletSnapshot() {
    const snapshot = await walletApi.getWallet();
    setWalletSnapshot(snapshot);
    return snapshot;
  }

  async function refreshAccounts() {
    const accountList = sortAccounts(await accountsApi.list());

    setAccounts(mergeWalletIntoAccounts(accountList, wallet));
    setActiveAccountId((current) => {
      const defaultAccount =
        accountList.find((account) => account.isDefault) ?? accountList[0] ?? null;

      if (!defaultAccount) {
        return null;
      }

      return defaultAccount.id;
    });

    return accountList;
  }

  async function setActiveAccount(accountId: string) {
    const account = await accountsApi.setDefault(accountId);
    await Promise.all([refreshAccounts(), refreshWalletSnapshot()]);
    setActiveAccountId(account.id);
    setSwitcherOpen(false);
    return account;
  }

  async function createAccount(
    payload: CreateAccountRequest,
    options?: CreateAccountOptions,
  ) {
    const createdAccount = await accountsApi.create(payload);
    const shouldActivate = Boolean(options?.activate || createdAccount.isDefault);

    if (shouldActivate) {
      await accountsApi.setDefault(createdAccount.id);
    }

    await Promise.all([
      refreshAccounts(),
      shouldActivate ? refreshWalletSnapshot() : Promise.resolve(null),
    ]);

    if (shouldActivate) {
      setActiveAccountId(createdAccount.id);
      setSwitcherOpen(false);
    }

    return createdAccount;
  }

  async function resetDemoAccount(accountId: string) {
    const account = await accountsApi.resetDemo(accountId);
    await Promise.all([
      refreshAccounts(),
      activeAccountId === accountId ? refreshWalletSnapshot() : Promise.resolve(null),
    ]);
    return account;
  }

  async function closeAccount(accountId: string) {
    await accountsApi.close(accountId);
    await Promise.all([refreshAccounts(), refreshWalletSnapshot()]);
    setSwitcherOpen(false);
  }

  useEffect(() => {
    if (!token || userRole === 'ADMIN') {
      setAccounts([]);
      setActiveAccountId(null);
      setLoading(false);
      return;
    }

    let active = true;

    async function hydrate() {
      setLoading(true);

      try {
        const [accountList, walletSnapshot] = await Promise.all([
          accountsApi.list(),
          walletApi.getWallet().catch(() => null),
        ]);

        if (!active) {
          return;
        }

        if (walletSnapshot) {
          setWalletSnapshot(walletSnapshot);
        }

        const nextAccounts = mergeWalletIntoAccounts(
          sortAccounts(accountList),
          walletSnapshot?.wallet ?? wallet,
        );
        const defaultAccount =
          nextAccounts.find((account) => account.isDefault) ?? nextAccounts[0] ?? null;

        setAccounts(nextAccounts);
        setActiveAccountId(defaultAccount?.id ?? null);
      } catch (error) {
        if (active) {
          pushNotification({
            title: 'Accounts unavailable',
            description: error instanceof Error ? error.message : 'Request failed',
            type: 'error',
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, [pushNotification, setWalletSnapshot, token, userRole]);

  useEffect(() => {
    if (!wallet) {
      return;
    }

    setAccounts((current) => mergeWalletIntoAccounts(current, wallet));
    setActiveAccountId(wallet.id);
  }, [wallet]);

  const activeAccount =
    accounts.find((account) => account.id === activeAccountId) ?? null;

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccount,
        activeAccountId,
        loading,
        switcherOpen,
        setSwitcherOpen,
        refreshAccounts,
        setActiveAccount,
        createAccount,
        resetDemoAccount,
        closeAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext() {
  return useContext(AccountContext);
}
