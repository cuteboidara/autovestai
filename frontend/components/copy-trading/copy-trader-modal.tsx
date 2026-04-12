'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatNumber, formatPercentage, formatUsdt } from '@/lib/utils';
import { copyTradingApi } from '@/services/api/copy-trading';
import { useNotificationStore } from '@/store/notification-store';
import { AccountSummary } from '@/types/account';
import {
  CopyRelationRecord,
  SignalProviderProfile,
  SignalProviderSummary,
} from '@/types/copy-trading';

interface CopyTraderModalProps {
  open: boolean;
  mode?: 'start' | 'adjust';
  provider: SignalProviderSummary | SignalProviderProfile | null;
  relation?: CopyRelationRecord | null;
  accounts: AccountSummary[];
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

export function CopyTraderModal({
  open,
  mode = 'start',
  provider,
  relation,
  accounts,
  onClose,
  onSuccess,
}: CopyTraderModalProps) {
  const pushNotification = useNotificationStore((state) => state.push);
  const [allocatedAmount, setAllocatedAmount] = useState('');
  const [copyRatio, setCopyRatio] = useState(1);
  const [copyAccountId, setCopyAccountId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);

  const availableAccounts = useMemo(
    () => accounts.filter((account) => account.status === 'ACTIVE'),
    [accounts],
  );

  useEffect(() => {
    if (!open || !provider) {
      return;
    }

    if (relation) {
      setAllocatedAmount(String(relation.allocatedAmount));
      setCopyRatio(relation.copyRatio);
      setCopyAccountId(relation.copyAccountId);
      setAcknowledged(true);
      return;
    }

    setAllocatedAmount(String(provider.minCopyAmount));
    setCopyRatio(1);
    setCopyAccountId(
      availableAccounts.find((account) => account.isDefault)?.id ?? availableAccounts[0]?.id ?? '',
    );
    setAcknowledged(false);
  }, [availableAccounts, open, provider, relation]);

  if (!open || !provider) {
    return null;
  }

  const currentProvider = provider;
  const providerBalance = currentProvider.account.balance || 0;
  const relativeSizePercent =
    providerBalance > 0
      ? (Number(allocatedAmount || 0) / providerBalance) * copyRatio * 100
      : 0;
  const isAdjusting = mode === 'adjust' && Boolean(relation);
  const canSubmit =
    Number(allocatedAmount) >= currentProvider.minCopyAmount &&
    copyAccountId &&
    acknowledged &&
    (!currentProvider.isAccepting ? isAdjusting : true);

  async function submitCopy() {
    if (!canSubmit) {
      return;
    }

    setLoading(true);

    try {
      if (isAdjusting && relation) {
        await copyTradingApi.updateCopy(relation.id, {
          allocatedAmount: Number(allocatedAmount),
          copyRatio,
        });
      } else {
        await copyTradingApi.startCopy(currentProvider.id, {
          copyAccountId,
          allocatedAmount: Number(allocatedAmount),
          copyRatio,
        });
      }

      await onSuccess();
      pushNotification({
        title: isAdjusting ? 'Copy settings updated' : 'Copying started',
        description: currentProvider.displayName,
        type: 'success',
      });
      onClose();
    } catch (error) {
      pushNotification({
        title: isAdjusting ? 'Update failed' : 'Copy start failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-border bg-surface p-5 shadow-[0_32px_120px_rgba(2,6,23,0.48)] sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="label-eyebrow">{isAdjusting ? 'Adjust Copy' : 'Copy This Trader'}</p>
            <h3 className="mt-2 text-2xl font-semibold text-primary">{currentProvider.displayName}</h3>
            <p className="mt-2 text-sm text-secondary">
              {currentProvider.strategy || 'Discretionary signal provider'}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mt-6 grid gap-4 rounded-3xl border border-border bg-page px-4 py-4 sm:px-5 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Return</p>
            <p className="mt-2 text-lg font-semibold text-emerald-300">
              {formatPercentage(currentProvider.totalReturn)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Win Rate</p>
            <p className="mt-2 text-lg font-semibold text-primary">{formatPercentage(currentProvider.winRate)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Max DD</p>
            <p className="mt-2 text-lg font-semibold text-rose-300">
              {formatPercentage(currentProvider.maxDrawdown)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Profit Fee</p>
            <p className="mt-2 text-lg font-semibold text-primary">{formatNumber(currentProvider.feePercent, 2)}%</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[1fr_1fr]">
          <Input
            label="Allocated Amount (USDT)"
            type="number"
            min={currentProvider.minCopyAmount}
            step="0.01"
            value={allocatedAmount}
            onChange={(event) => setAllocatedAmount(event.target.value)}
            helperText={`Minimum ${formatUsdt(currentProvider.minCopyAmount)}`}
          />
          <div className="space-y-2">
            <span className="label-eyebrow">Copy Ratio</span>
            <div className="rounded-3xl border border-border bg-page px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-secondary">Aggressiveness</p>
                <p className="text-lg font-semibold text-primary">{formatNumber(copyRatio, 1)}x</p>
              </div>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={copyRatio}
                onChange={(event) => setCopyRatio(Number(event.target.value))}
                className="mt-4 w-full accent-[#F0B429]"
              />
              <div className="mt-2 flex justify-between text-xs text-secondary">
                <span>0.1x</span>
                <span>3x</span>
              </div>
            </div>
          </div>
          <div className="md:col-span-2">
            <Select
              label="Destination Account"
              value={copyAccountId}
              onChange={(event) => setCopyAccountId(event.target.value)}
              disabled={isAdjusting}
            >
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} • {account.type} • {formatUsdt(account.balance)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-accent/20 bg-accent/10 p-4">
          <p className="text-sm font-medium text-primary">
            Your position sizes will be about {formatNumber(relativeSizePercent, 2)}% of the
            provider&apos;s current size.
          </p>
          <p className="mt-2 text-sm text-secondary">
            Estimate is based on the provider&apos;s current account balance of{' '}
            {formatUsdt(currentProvider.account.balance)}.
          </p>
        </div>

        <label className="mt-6 flex items-start gap-3 text-sm text-secondary">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border accent-[var(--accent)]"
          />
          <span>I understand copied trades execute automatically on the selected account.</span>
        </label>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void submitCopy()} disabled={!canSubmit || loading}>
            {loading
              ? 'Processing...'
              : isAdjusting
              ? 'Save Changes'
              : currentProvider.isAccepting
              ? 'Start Copying'
              : 'Provider Not Accepting'}
          </Button>
        </div>
      </div>
    </div>
  );
}
