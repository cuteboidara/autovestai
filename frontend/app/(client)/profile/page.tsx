'use client';

import Link from 'next/link';
import { Shield, UserRound } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAccountContext } from '@/context/account-context';
import { formatDateTime, formatNumber, formatUsdt } from '@/lib/utils';
import { accountsApi } from '@/services/api/accounts';
import { authApi } from '@/services/api/auth';
import { positionsApi } from '@/services/api/positions';
import { usersApi } from '@/services/api/users';
import { useAuthStore } from '@/store/auth-store';
import { useNotificationStore } from '@/store/notification-store';

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36" />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Skeleton className="h-[280px]" />
        <Skeleton className="h-[280px]" />
      </div>

      <Skeleton className="h-[360px]" />
    </div>
  );
}

export default function ProfilePage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeAccountId } = useAccountContext();
  const logoutAllOtherSessions = useAuthStore((state) => state.logoutAllOtherSessions);
  const pushNotification = useNotificationStore((state) => state.push);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const activeTab = searchParams.get('tab') === 'security' ? 'security' : 'profile';

  const pageQuery = useQuery({
    queryKey: ['client-profile-page', activeAccountId],
    queryFn: async () => {
      const [profile, sessions, account, positions] = await Promise.all([
        usersApi.getCurrentUser(),
        authApi.listSessions().catch(() => []),
        activeAccountId ? accountsApi.get(activeAccountId) : Promise.resolve(null),
        activeAccountId ? positionsApi.list(activeAccountId, 'OPEN') : Promise.resolve([]),
      ]);

      return {
        profile,
        sessions,
        account,
        positions,
      };
    },
  });

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (value === 'profile') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  async function refreshPage() {
    await pageQuery.refetch();
  }

  async function revokeSession(sessionId: string) {
    try {
      await authApi.revokeSession(sessionId);
      await refreshPage();
      pushNotification({
        title: 'Session revoked',
        description: 'The selected device session has been revoked.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Session revoke failed',
        description: error instanceof Error ? error.message : 'Unable to revoke session',
        type: 'error',
      });
    }
  }

  async function revokeOtherSessions() {
    try {
      await logoutAllOtherSessions();
      await refreshPage();
      pushNotification({
        title: 'Other sessions revoked',
        description: 'All non-current sessions have been revoked.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Bulk revoke failed',
        description: error instanceof Error ? error.message : 'Unable to revoke sessions',
        type: 'error',
      });
    }
  }

  async function submitPasswordChange() {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      pushNotification({
        title: 'Password update failed',
        description: 'New password confirmation does not match.',
        type: 'error',
      });
      return;
    }

    setPasswordSubmitting(true);

    try {
      await usersApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      pushNotification({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Password update failed',
        description: error instanceof Error ? error.message : 'Unable to update password',
        type: 'error',
      });
    } finally {
      setPasswordSubmitting(false);
    }
  }

  if (pageQuery.isLoading || !pageQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Client Portal / My Account"
          title="My Account"
          description="Personal profile details, active account visibility, open positions, and security controls."
          actions={
            <SegmentedControl
              items={[
                { value: 'profile', label: 'Profile' },
                { value: 'security', label: 'Security' },
              ]}
              value={activeTab}
              onChange={setTab}
            />
          }
        />
        <ProfileSkeleton />
      </div>
    );
  }

  const { profile, sessions, account, positions } = pageQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Portal / My Account"
        title="My Account"
        description="Personal profile details, active account visibility, open positions, and security controls."
        actions={
          <SegmentedControl
            items={[
              { value: 'profile', label: 'Profile' },
              { value: 'security', label: 'Security' },
            ]}
            value={activeTab}
            onChange={setTab}
          />
        }
      />

      {activeTab === 'profile' ? (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            <StatCard label="Email" value={profile.email} helper={profile.role} />
            <StatCard
              label="KYC Status"
              value={<StatusBadge value={profile.kyc?.status ?? 'NOT_SUBMITTED'} />}
              helper={profile.kyc?.rejectionReason ?? 'Verification status for withdrawals and compliance checks.'}
            />
            <StatCard
              label="Active Balance"
              value={account ? formatUsdt(account.balance) : '--'}
              helper={account ? account.accountNo : 'No active account'}
            />
            <StatCard
              label="Open Positions"
              value={positions.length}
              helper={account ? `${account.type} account` : 'Select an account'}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <Panel title="Profile Details" description="Current authenticated account details and compliance status.">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <p className="label-eyebrow">Full Name</p>
                  <p className="mt-3 text-sm text-primary">
                    {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || '--'}
                  </p>
                </div>
                <div>
                  <p className="label-eyebrow">Email Address</p>
                  <p className="mt-3 text-sm text-primary">{profile.email}</p>
                </div>
                <div>
                  <p className="label-eyebrow">Role</p>
                  <p className="mt-3 text-sm text-primary">{profile.role}</p>
                </div>
                <div>
                  <p className="label-eyebrow">Member Since</p>
                  <p className="mt-3 text-sm text-primary">
                    {profile.createdAt ? formatDateTime(profile.createdAt) : '--'}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel
              title="Active Account"
              description="Live account metrics for the currently selected trading account."
              actions={
                <Button variant="secondary" asChild>
                  <Link href="/accounts">Manage Accounts</Link>
                </Button>
              }
            >
              {account ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={
                        account.type === 'LIVE'
                          ? 'inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300'
                          : 'inline-flex rounded-full border border-slate-500/25 bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300'
                      }
                    >
                      {account.type}
                    </span>
                    <StatusBadge value={account.status} />
                  </div>

                  <div>
                    <p className="text-xl font-semibold text-primary">{account.accountNo}</p>
                    <p className="mt-2 text-sm text-secondary">{account.name}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-page px-4 py-4">
                      <p className="label-eyebrow">Balance</p>
                      <p className="mt-3 text-lg font-semibold text-primary">
                        {formatUsdt(account.balance)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-page px-4 py-4">
                      <p className="label-eyebrow">Equity</p>
                      <p className="mt-3 text-lg font-semibold text-primary">
                        {formatUsdt(account.equity)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-page px-4 py-4">
                      <p className="label-eyebrow">Free Margin</p>
                      <p className="mt-3 text-lg font-semibold text-primary">
                        {formatUsdt(account.freeMargin)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-page px-4 py-4">
                      <p className="label-eyebrow">Open Positions</p>
                      <p className="mt-3 text-lg font-semibold text-primary">
                        {account.openPositions}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No active account selected"
                  description="Pick a live or demo account to view balances, margin, and open positions."
                  icon={<UserRound className="h-5 w-5" />}
                  action={
                    <Button asChild>
                      <Link href="/accounts">Choose Account</Link>
                    </Button>
                  }
                />
              )}
            </Panel>
          </div>

          <Panel title="Open Positions" description="Live market exposure for the currently selected account.">
            <DataTable
              columns={[
                {
                  key: 'symbol',
                  header: 'Symbol',
                  render: (position) => (
                    <span className="font-medium text-primary">{position.symbol}</span>
                  ),
                },
                {
                  key: 'side',
                  header: 'Side',
                  render: (position) => position.side,
                },
                {
                  key: 'size',
                  header: 'Size',
                  align: 'right',
                  render: (position) => formatNumber(position.volume, 4),
                },
                {
                  key: 'entry',
                  header: 'Entry',
                  align: 'right',
                  render: (position) => formatNumber(position.entryPrice, 5),
                },
                {
                  key: 'current',
                  header: 'Current Price',
                  align: 'right',
                  render: (position) =>
                    position.currentPrice !== null ? formatNumber(position.currentPrice, 5) : '--',
                },
                {
                  key: 'pnl',
                  header: 'P&L',
                  align: 'right',
                  render: (position) => {
                    const pnl = position.unrealizedPnl ?? position.pnl;

                    return (
                      <span className={pnl >= 0 ? 'font-medium text-emerald-300' : 'font-medium text-red-300'}>
                        {formatUsdt(pnl)}
                      </span>
                    );
                  },
                },
              ]}
              data={positions}
              rowKey={(position) => position.id}
              emptyTitle="No open positions yet"
              emptyDescription="Open trades will appear here once you place your first order."
              emptyIcon={<Shield className="h-5 w-5" />}
              emptyAction={
                <Button asChild>
                  <Link href="/trade">Open Terminal</Link>
                </Button>
              }
            />
          </Panel>
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Panel title="Password" description="Update the password used to sign in to the client portal.">
            <div className="grid gap-4">
              <Input
                label="Current Password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
              />
              <Input
                label="New Password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    newPassword: event.target.value,
                  }))
                }
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
              <div className="flex justify-end">
                <Button
                  disabled={
                    passwordSubmitting ||
                    !passwordForm.currentPassword ||
                    !passwordForm.newPassword ||
                    !passwordForm.confirmPassword
                  }
                  onClick={() => void submitPasswordChange()}
                >
                  {passwordSubmitting ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </div>
          </Panel>

          <Panel
            title="Sessions"
            description="Review active devices, last seen timestamps, and revoke access remotely."
            actions={
              <Button variant="secondary" onClick={() => void revokeOtherSessions()}>
                Revoke Other Sessions
              </Button>
            }
          >
            {sessions.length === 0 ? (
              <EmptyState
                title="No additional sessions"
                description="Only the current device session is active right now."
                icon={<Shield className="h-5 w-5" />}
              />
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-2xl border border-border bg-page p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-primary">
                          {session.userAgent ?? 'Unknown device'}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                          {session.isCurrent ? 'Current session' : 'Remote session'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge value={session.revokedAt ? 'revoked' : 'active'} />
                        {!session.isCurrent && !session.revokedAt ? (
                          <Button variant="danger" onClick={() => void revokeSession(session.id)}>
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-secondary md:grid-cols-2">
                      <p>IP: {session.ipAddress ?? '--'}</p>
                      <p>Last seen: {formatDateTime(session.lastSeenAt)}</p>
                      <p>Created: {formatDateTime(session.createdAt)}</p>
                      <p>Expires: {formatDateTime(session.expiresAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
