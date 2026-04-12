'use client';

import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatUsdt } from '@/lib/utils';
import { useAuthStore } from '@/store/auth-store';
import { usePlatformStore } from '@/store/platform-store';
import { useWalletStore } from '@/store/wallet-store';

export default function SupportPage() {
  const user = useAuthStore((state) => state.user);
  const wallet = useWalletStore((state) => state.wallet);
  const transactions = useWalletStore((state) => state.transactions);
  const platformStatus = usePlatformStore((state) => state.status);

  const pendingTransactions = transactions.filter((entry) => entry.status === 'PENDING').length;
  const kycStatus = user?.kyc?.status ?? 'NOT_SUBMITTED';
  const withdrawalsEnabled = platformStatus?.features.withdrawalsEnabled ?? true;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Operations Support"
        description="Navigate the account, funding, verification, and trading workflows that resolve the most common issues."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Verification" description="Current compliance access state.">
          <div className="space-y-3">
            <StatusBadge value={kycStatus} />
            <p className="text-sm text-secondary">
              Complete or update KYC if trading or withdrawals are restricted.
            </p>
            <Button asChild variant="secondary">
              <Link href="/kyc">Open KYC</Link>
            </Button>
          </div>
        </Panel>

        <Panel title="Funding" description="Default wallet and pending transfer requests.">
          <div className="space-y-3 text-sm text-secondary">
            <p>Balance: <span className="font-medium text-primary">{wallet ? formatUsdt(wallet.balance) : '--'}</span></p>
            <p>Pending requests: <span className="font-medium text-primary">{pendingTransactions}</span></p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/deposit">Deposit</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/transactions">Transactions</Link>
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Trading Access" description="Default account state and platform withdrawals status.">
          <div className="space-y-3 text-sm text-secondary">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={wallet?.status ?? 'UNKNOWN'} />
              <StatusBadge value={withdrawalsEnabled ? 'WITHDRAWALS_ON' : 'WITHDRAWALS_OFF'} />
            </div>
            <p>
              Use the trading terminal for order routing issues and the accounts center for
              account switching or demo resets.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/trade">Open Terminal</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/accounts">Manage Accounts</Link>
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Routing Guide" description="Fastest path to resolve the current category of issue.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Link href="/wallet?tab=deposit" className="rounded-2xl border border-border bg-page p-4 transition hover:border-accent/40">
            <p className="font-medium text-primary">Deposit not credited</p>
            <p className="mt-2 text-sm text-secondary">Check the generated address, network, and pending transaction status.</p>
          </Link>
          <Link href="/wallet?tab=withdraw" className="rounded-2xl border border-border bg-page p-4 transition hover:border-accent/40">
            <p className="font-medium text-primary">Withdrawal pending</p>
            <p className="mt-2 text-sm text-secondary">Review withdrawal status, KYC approval, and current free margin.</p>
          </Link>
          <Link href="/trade" className="rounded-2xl border border-border bg-page p-4 transition hover:border-accent/40">
            <p className="font-medium text-primary">Order or pricing issue</p>
            <p className="mt-2 text-sm text-secondary">Open the terminal to inspect symbol health, positions, and order history.</p>
          </Link>
          <Link href="/profile?tab=security" className="rounded-2xl border border-border bg-page p-4 transition hover:border-accent/40">
            <p className="font-medium text-primary">Security or session issue</p>
            <p className="mt-2 text-sm text-secondary">Update the password and revoke remote sessions from the security tab.</p>
          </Link>
        </div>
      </Panel>
    </div>
  );
}
