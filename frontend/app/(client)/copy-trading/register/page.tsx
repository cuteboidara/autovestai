'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatNumber, formatUsdt } from '@/lib/utils';
import { accountsApi } from '@/services/api/accounts';
import { copyTradingApi } from '@/services/api/copy-trading';
import { useNotificationStore } from '@/store/notification-store';
import { AccountSummary } from '@/types/account';

export default function RegisterSignalProviderPage() {
  const router = useRouter();
  const pushNotification = useNotificationStore((state) => state.push);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [existingProviderId, setExistingProviderId] = useState<string | null>(null);
  const [form, setForm] = useState({
    accountId: '',
    displayName: '',
    bio: '',
    strategy: '',
    avatarUrl: '',
    minCopyAmount: '100',
    feePercent: '10',
  });

  const liveAccounts = useMemo(
    () => accounts.filter((account) => account.type === 'LIVE' && account.status === 'ACTIVE'),
    [accounts],
  );

  useEffect(() => {
    void Promise.all([accountsApi.list(), copyTradingApi.getMyProvider().catch(() => null)])
      .then(([accountList, provider]) => {
        setAccounts(accountList);
        setForm((current) => ({
          ...current,
          accountId:
            current.accountId ||
            accountList.find((account) => account.type === 'LIVE' && account.isDefault)?.id ||
            accountList.find((account) => account.type === 'LIVE')?.id ||
            '',
        }));
        setExistingProviderId(provider?.id ?? null);
      })
      .catch((error) => {
        pushNotification({
          title: 'Unable to load provider setup',
          description: error instanceof Error ? error.message : 'Request failed',
          type: 'error',
        });
      });
  }, [pushNotification]);

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        avatarUrl: typeof reader.result === 'string' ? reader.result : '',
      }));
    };
    reader.readAsDataURL(file);
  }

  async function publishProvider() {
    setSubmitting(true);

    try {
      const provider = await copyTradingApi.registerProvider({
        accountId: form.accountId,
        displayName: form.displayName,
        bio: form.bio,
        strategy: form.strategy,
        avatarUrl: form.avatarUrl || undefined,
        minCopyAmount: Number(form.minCopyAmount),
        feePercent: Number(form.feePercent),
      });

      pushNotification({
        title: 'Provider published',
        description: provider.displayName,
        type: 'success',
      });
      router.push(`/copy-trading/${provider.id}`);
    } catch (error) {
      pushNotification({
        title: 'Unable to publish provider',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (existingProviderId) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Client Portal / Copy Trading"
          title="Provider profile already exists"
          description="This account already has a published signal provider profile."
          actions={
            <Button asChild>
              <Link href={`/copy-trading/${existingProviderId}`}>Open Provider Profile</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Portal / Copy Trading"
        title="Become a Provider"
        description="Choose a LIVE signal account, add a public profile, and publish to the marketplace."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <Panel title={`Step ${step} of 3`} description="Create a public copy-trading profile.">
          {step === 1 ? (
            <div className="space-y-5">
              <Select
                label="Choose your signal account"
                value={form.accountId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accountId: event.target.value }))
                }
              >
                {liveAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} • {account.accountNo} • {formatUsdt(account.balance)}
                  </option>
                ))}
              </Select>
              <div className="flex justify-end">
                <Button
                  disabled={!form.accountId}
                  onClick={() => setStep(2)}
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-5">
              <Input
                label="Display Name"
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="Atlas FX"
              />
              <Textarea
                label="Bio"
                value={form.bio}
                onChange={(event) =>
                  setForm((current) => ({ ...current, bio: event.target.value }))
                }
                placeholder="Tell followers how you trade and manage risk."
              />
              <Textarea
                label="Strategy Description"
                value={form.strategy}
                onChange={(event) =>
                  setForm((current) => ({ ...current, strategy: event.target.value }))
                }
                placeholder="Momentum breakout strategy focused on majors and gold."
              />
              <label className="block space-y-2">
                <span className="label-eyebrow">Avatar Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="block w-full rounded-lg border border-border bg-page px-3 py-3 text-sm text-primary"
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Min Copy Amount"
                  type="number"
                  min="1"
                  value={form.minCopyAmount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, minCopyAmount: event.target.value }))
                  }
                />
                <Input
                  label="Fee %"
                  type="number"
                  min="0"
                  max="100"
                  value={form.feePercent}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, feePercent: event.target.value }))
                  }
                />
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  disabled={!form.displayName || !form.strategy}
                  onClick={() => setStep(3)}
                >
                  Review
                </Button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <div className="rounded-3xl bg-page p-5">
                <p className="label-eyebrow">Signal Account</p>
                <p className="mt-2 text-lg font-semibold text-primary">
                  {liveAccounts.find((account) => account.id === form.accountId)?.name || '--'}
                </p>
              </div>
              <div className="rounded-3xl bg-page p-5">
                <p className="label-eyebrow">Display Name</p>
                <p className="mt-2 text-lg font-semibold text-primary">{form.displayName}</p>
                <p className="mt-3 text-sm text-secondary">{form.bio || 'No bio provided.'}</p>
                <p className="mt-3 text-sm text-secondary">{form.strategy}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl bg-page p-5">
                  <p className="label-eyebrow">Min Copy Amount</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {formatUsdt(form.minCopyAmount)}
                  </p>
                </div>
                <div className="rounded-3xl bg-page p-5">
                  <p className="label-eyebrow">Profit Fee</p>
                  <p className="mt-2 text-lg font-semibold text-primary">
                    {formatNumber(form.feePercent, 2)}%
                  </p>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button disabled={submitting} onClick={() => void publishProvider()}>
                  {submitting ? 'Publishing...' : 'Publish to Marketplace'}
                </Button>
              </div>
            </div>
          ) : null}
        </Panel>

        <Panel title="Preview" description="How your marketplace card will look.">
          <div className="overflow-hidden rounded-[32px] border border-border bg-surface shadow-glow">
            <div className="bg-[radial-gradient(circle_at_top_left,rgba(245,166,35,0.18),transparent_34%),linear-gradient(135deg,#0F172A_0%,#111827_100%)] p-5 text-primary">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={form.displayName || 'Provider avatar'} className="h-16 w-16 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold">
                    {(form.displayName || 'AV').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold">{form.displayName || 'Your Display Name'}</h3>
                  <p className="mt-1 inline-flex max-w-full rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-secondary">
                    {form.strategy || 'Strategy description'}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-secondary">{form.bio || 'Your provider bio will appear here.'}</p>
              <div className="flex items-center justify-between rounded-2xl bg-page px-4 py-3 text-sm">
                <span className="text-secondary">Min Copy: {formatUsdt(form.minCopyAmount)}</span>
                <span className="font-medium text-primary">Fee: {formatNumber(form.feePercent, 2)}%</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
