'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { formatDateTime, formatNumber, formatUsdt } from '@/lib/utils';
import { useNotificationStore } from '@/store/notification-store';
import { AdminUserDetail, AdminUserListItem } from '@/types/admin';

export default function AdminUsersPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [mutatingUser, setMutatingUser] = useState<'activate' | 'suspend' | null>(null);
  const canViewUsers = hasPermission('users.view');
  const canManageUsers = hasPermission('users.manage');

  async function loadUsers(term?: string) {
    const response = await adminApi.listUsers(term);
    setUsers(response);
  }

  async function selectUser(id: string) {
    setLoadingDetail(true);
    try {
      const detail = await adminApi.getUserDetail(id);
      setSelectedUser(detail);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function mutateSelectedUser(action: 'activate' | 'suspend') {
    if (!selectedUser) {
      return;
    }

    setMutatingUser(action);

    try {
      const updated =
        action === 'activate'
          ? await adminApi.activateUser(selectedUser.id)
          : await adminApi.suspendUser(selectedUser.id);

      setSelectedUser(updated);
      await loadUsers(search);
      pushNotification({
        title: action === 'activate' ? 'User activated' : 'User suspended',
        description: updated.email,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: action === 'activate' ? 'Activation failed' : 'Suspension failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setMutatingUser(null);
    }
  }

  useEffect(() => {
    if (!canViewUsers) {
      return;
    }

    void loadUsers();
  }, [canViewUsers]);

  if (!canViewUsers) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Users"
          title="User search and detail"
          description="Role, KYC status, balances, open positions, affiliate state, and provider activity."
        />
        <PermissionDenied
          title="User directory unavailable"
          description="This admin account does not have permission to view user records."
          requiredPermission="users.view"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="Users"
        description="Role, KYC status, balances, account status, open positions, and provider relationships."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Users Table"
          description="Search by email or user ID."
          actions={
            <div className="flex items-center gap-3">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users"
              />
              <Button variant="secondary" onClick={() => void loadUsers(search)}>
                Search
              </Button>
            </div>
          }
        >
          <DataTable
            columns={[
              {
                key: 'email',
                header: 'Email',
                render: (user) => <span className="font-medium text-primary">{user.email}</span>,
              },
              {
                key: 'role',
                header: 'Role',
                render: (user) => <StatusBadge value={user.role} />,
              },
              {
                key: 'kyc',
                header: 'KYC',
                render: (user) => <StatusBadge value={user.kycStatus} />,
              },
              {
                key: 'balance',
                header: 'Balances',
                align: 'right',
                render: (user) => formatUsdt(user.walletBalance),
              },
              {
                key: 'accounts',
                header: 'Accounts',
                render: (user) => (
                  <div className="space-y-1">
                    <StatusBadge value={user.accountStatus} />
                    <p className="text-xs text-secondary">{user.totalAccounts} total</p>
                  </div>
                ),
              },
              {
                key: 'positions',
                header: 'Open Positions',
                align: 'right',
                render: (user) => user.openPositions,
              },
            ]}
            data={users}
            rowKey={(user) => user.id}
            onRowClick={(user) => void selectUser(user.id)}
            emptyTitle="No users found"
            emptyDescription="Search by email or user ID to inspect account records."
          />
        </Panel>

        <Panel
          title="User Detail"
          description="Positions, accounts, transactions, KYC, and relationship state."
          actions={
            canManageUsers && selectedUser ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={
                    mutatingUser !== null ||
                    selectedUser.accounts.every((account) => account.status === 'ACTIVE')
                  }
                  onClick={() => void mutateSelectedUser('activate')}
                >
                  {mutatingUser === 'activate' ? 'Activating...' : 'Activate'}
                </Button>
                <Button
                  variant="danger"
                  disabled={
                    mutatingUser !== null ||
                    selectedUser.accounts.every((account) => account.status === 'SUSPENDED')
                  }
                  onClick={() => void mutateSelectedUser('suspend')}
                >
                  {mutatingUser === 'suspend' ? 'Suspending...' : 'Suspend'}
                </Button>
              </div>
            ) : undefined
          }
        >
          {loadingDetail ? (
            <p className="text-sm text-secondary">Loading user detail...</p>
          ) : selectedUser ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="text-lg font-semibold text-primary">{selectedUser.email}</p>
                <p className="mt-1 text-sm text-secondary">{selectedUser.id}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge value={selectedUser.role} />
                  <StatusBadge value={selectedUser.kycSubmission?.status ?? 'not_submitted'} />
                  {selectedUser.affiliate ? <StatusBadge value={selectedUser.affiliate.status} /> : null}
                  {selectedUser.signalProvider ? <StatusBadge value={selectedUser.signalProvider.status} /> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">Primary balance (USDT)</p>
                  <p className="mt-2 text-xl font-semibold text-primary">
                    {selectedUser.wallet ? formatUsdt(selectedUser.wallet.balance) : '--'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">Open positions</p>
                  <p className="mt-2 text-xl font-semibold text-primary">{selectedUser.positions.length}</p>
                </div>
                <div className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">Accounts</p>
                  <p className="mt-2 text-xl font-semibold text-primary">{selectedUser.accounts.length}</p>
                </div>
              </div>

              <div>
                <p className="label-eyebrow">Accounts</p>
                <div className="mt-3 grid gap-3">
                  {selectedUser.accounts.map((account) => (
                    <div key={account.id} className="rounded-2xl border border-border bg-page p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-primary">
                            {account.name} ({account.accountNo})
                          </p>
                          <p className="mt-1 text-sm text-secondary">
                            {account.type} • Equity {formatUsdt(account.equity)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge value={account.type} />
                          <StatusBadge value={account.status} />
                          {account.isDefault ? <StatusBadge value="DEFAULT" /> : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="label-eyebrow">Recent positions</p>
                <div className="mt-3 space-y-3">
                  {selectedUser.positions.slice(0, 5).map((position) => (
                    <div key={position.id} className="rounded-2xl border border-border bg-page p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-primary">
                          {position.symbol} {position.side}
                        </p>
                        <p className="text-sm text-secondary">{formatUsdt(position.pnl)}</p>
                      </div>
                      <p className="mt-2 text-sm text-secondary">
                        {formatNumber(position.volume, 4)} @ {formatNumber(position.entryPrice, 2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="label-eyebrow">Recent transactions</p>
                <div className="mt-3 space-y-3">
                  {selectedUser.transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="rounded-2xl border border-border bg-page p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-primary">{transaction.type}</p>
                        <StatusBadge value={transaction.status} />
                      </div>
                      <p className="mt-2 text-sm text-secondary">
                        {formatUsdt(transaction.amount)} • {formatDateTime(transaction.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-secondary">Select a user to inspect account state.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
