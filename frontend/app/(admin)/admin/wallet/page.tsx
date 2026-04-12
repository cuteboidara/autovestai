'use client';

import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { WalletTransaction } from '@/types/wallet';
import {
  AdminDepositAddressRecord,
  AdminIncomingWalletTransaction,
} from '@/types/admin';

export default function AdminWalletPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [pendingItems, setPendingItems] = useState<WalletTransaction[]>([]);
  const [depositAddresses, setDepositAddresses] = useState<AdminDepositAddressRecord[]>([]);
  const [incomingTransactions, setIncomingTransactions] = useState<
    AdminIncomingWalletTransaction[]
  >([]);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    userId: '',
  });
  const [pendingAction, setPendingAction] = useState<{
    type: 'approve' | 'reject';
    item: WalletTransaction;
  } | null>(null);
  const [reason, setReason] = useState('');
  const canViewTransactions = hasPermission('transactions.view');
  const canApproveDeposits = hasPermission('deposits.approve');
  const canApproveWithdrawals = hasPermission('withdrawals.approve');

  const pendingCounts = useMemo(
    () => ({
      deposits: pendingItems.filter((item) => item.type === 'DEPOSIT').length,
      withdrawals: pendingItems.filter((item) => item.type === 'WITHDRAW').length,
    }),
    [pendingItems],
  );
  const addressCounts = useMemo(() => {
    return depositAddresses.reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.network] = (accumulator[entry.network] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [depositAddresses]);

  async function refreshTransactions() {
    const query = new URLSearchParams();
    if (filters.status) {
      query.set('status', filters.status);
    }
    if (filters.type) {
      query.set('type', filters.type);
    }
    if (filters.userId) {
      query.set('userId', filters.userId);
    }

    const response = await adminApi.listWalletTransactions(query.toString());
    setItems(response);
  }

  async function refreshPendingTransactions() {
    const response = await adminApi.listPendingTransactions();
    setPendingItems(response);
  }

  async function refreshSupplemental() {
    const [addresses, incoming] = await Promise.all([
      adminApi.listDepositAddresses(),
      adminApi.listIncomingTransactions(),
    ]);
    setDepositAddresses(addresses);
    setIncomingTransactions(incoming);
  }

  useEffect(() => {
    if (!canViewTransactions) {
      return;
    }

    void Promise.all([
      refreshTransactions(),
      refreshPendingTransactions(),
      refreshSupplemental(),
    ]);
  }, [canViewTransactions]);

  function canDecideTransaction(item: WalletTransaction) {
    if (item.type === 'DEPOSIT') {
      return canApproveDeposits;
    }

    if (item.type === 'WITHDRAW') {
      return canApproveWithdrawals;
    }

    return false;
  }

  function hasVerifiedDepositReference(item: WalletTransaction) {
    if (item.type !== 'DEPOSIT') {
      return true;
    }

    return Boolean(
      item.metadata?.autoDetected === true ||
        (typeof item.metadata?.depositId === 'string' &&
          item.metadata.depositId.trim().length > 0),
    );
  }

  if (!canViewTransactions) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Wallet Ops"
          title="Deposit and withdrawal approvals"
          description="Filter requests by status, approve or reject pending items, and inspect historical wallet transactions."
        />
        <PermissionDenied
          title="Wallet operations unavailable"
          description="This admin account does not have permission to review wallet operations."
          requiredPermission="transactions.view"
        />
      </div>
    );
  }

  async function confirmAction() {
    if (!pendingAction) {
      return;
    }

    try {
      if (pendingAction.type === 'approve') {
        await adminApi.approveTransaction(pendingAction.item.id, reason || undefined);
      } else {
        await adminApi.rejectTransaction(pendingAction.item.id, reason || undefined);
      }

      pushNotification({
        title: `Transaction ${pendingAction.type}d`,
        description: `${pendingAction.item.type} request updated.`,
        type: 'success',
      });
      setPendingAction(null);
      setReason('');
      await Promise.all([
        refreshTransactions(),
        refreshPendingTransactions(),
        refreshSupplemental(),
      ]);
    } catch (error) {
      pushNotification({
        title: 'Transaction action failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet Ops"
        title="Wallet Queue"
        description="Filter requests by status, approve or reject pending items, and inspect historical wallet transactions."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Deposits" value={pendingCounts.deposits} />
        <StatCard label="Pending Withdrawals" value={pendingCounts.withdrawals} />
        <StatCard label="TRC20 Addresses" value={addressCounts.TRC20 ?? 0} />
        <StatCard label="Incoming Detections" value={incomingTransactions.length} />
      </div>

      <Panel
        title="Pending Review Queue"
        description="All pending deposit and withdrawal transactions awaiting manual admin approval."
      >
        <DataTable
          columns={[
            {
              key: 'created',
              header: 'Created',
              render: (item) => formatDateTime(item.createdAt),
            },
            { key: 'user', header: 'User', render: (item) => item.userId },
            { key: 'type', header: 'Type', render: (item) => item.type },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (item) => formatCurrency(item.amount),
            },
            {
              key: 'reference',
              header: 'Reference',
              render: (item) =>
                String(
                  (typeof item.metadata?.blockchainTxId === 'string'
                    ? item.metadata.blockchainTxId
                    : item.reference) ?? '--',
                ),
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (item) =>
                canDecideTransaction(item) ? (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={!hasVerifiedDepositReference(item)}
                      onClick={() => setPendingAction({ type: 'approve', item })}
                    >
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => setPendingAction({ type: 'reject', item })}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-secondary">No approval access</span>
                ),
            },
          ]}
          data={pendingItems}
          rowKey={(item) => item.id}
          emptyTitle="No pending wallet requests"
          emptyDescription="New deposits and withdrawals waiting for review will appear here."
        />
      </Panel>

      <Panel
        title="Wallet Transaction History"
        description="Filter the full wallet ledger and process pending operations."
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
            </Select>
            <Select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}>
              <option value="">All types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAW">Withdraw</option>
              <option value="TRADE">Trade</option>
            </Select>
            <Input
              value={filters.userId}
              onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
              placeholder="User ID"
            />
            <Button variant="secondary" onClick={() => void refreshTransactions()}>
              Apply
            </Button>
          </div>
        }
      >
        <DataTable
          columns={[
            {
              key: 'created',
              header: 'Created',
              render: (item) => formatDateTime(item.createdAt),
            },
            { key: 'user', header: 'User', render: (item) => item.userId },
            { key: 'type', header: 'Type', render: (item) => item.type },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (item) => formatCurrency(item.amount),
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => <StatusBadge value={item.status} />,
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (item) =>
                item.status === 'PENDING' && canDecideTransaction(item) ? (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={!hasVerifiedDepositReference(item)}
                      onClick={() => setPendingAction({ type: 'approve', item })}
                    >
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => setPendingAction({ type: 'reject', item })}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-secondary">
                    {item.status === 'PENDING' ? 'No approval access' : 'Processed'}
                  </span>
                ),
            },
          ]}
          data={items}
          rowKey={(item) => item.id}
          emptyTitle="No wallet requests"
          emptyDescription="Filtered wallet transactions will appear here."
        />
      </Panel>

      <Panel
        title="Deposit Addresses"
        description="Deterministic addresses generated per user and network."
      >
        <DataTable
          columns={[
            {
              key: 'created',
              header: 'Generated',
              render: (item) => formatDateTime(item.createdAt),
            },
            {
              key: 'user',
              header: 'User',
              render: (item) => (
                <div>
                  <p className="font-medium text-primary">{item.user.email}</p>
                  <p className="text-xs text-secondary">{item.userId}</p>
                </div>
              ),
            },
            { key: 'network', header: 'Network', render: (item) => item.network },
            {
              key: 'address',
              header: 'Address',
              render: (item) => (
                <span className="font-mono text-xs text-primary">{item.address}</span>
              ),
            },
          ]}
          data={depositAddresses}
          rowKey={(item) => item.id}
          emptyTitle="No deposit addresses"
          emptyDescription="Addresses appear here when users request deposit coordinates."
        />
      </Panel>

      <Panel
        title="Incoming Transactions"
        description="Auto-detected blockchain deposits awaiting review or already processed."
      >
        <DataTable
          columns={[
            {
              key: 'time',
              header: 'Time',
              render: (item) => formatDateTime(item.createdAt),
            },
            {
              key: 'user',
              header: 'User',
              render: (item) => (
                <div>
                  <p className="font-medium text-primary">{item.user.email}</p>
                  <p className="text-xs text-secondary">{item.user.id}</p>
                </div>
              ),
            },
            {
              key: 'network',
              header: 'Network',
              render: (item) => String(item.metadata?.network ?? '--'),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (item) => formatCurrency(item.amount),
            },
            {
              key: 'txid',
              header: 'TxID',
              render: (item) => {
                const txid = typeof item.metadata?.blockchainTxId === 'string'
                  ? item.metadata.blockchainTxId
                  : item.reference;
                const explorerUrl =
                  typeof item.metadata?.explorerUrl === 'string'
                    ? item.metadata.explorerUrl
                    : null;

                if (!txid) {
                  return '--';
                }

                return explorerUrl ? (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-accent hover:text-accentHover"
                  >
                    {txid}
                  </a>
                ) : (
                  <span className="font-mono text-xs text-primary">{txid}</span>
                );
              },
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => <StatusBadge value={item.status} />,
            },
            {
              key: 'action',
              header: 'Action',
              render: (item) =>
                item.status === 'PENDING' && canDecideTransaction(item) ? (
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      disabled={!hasVerifiedDepositReference(item)}
                      onClick={() => setPendingAction({ type: 'approve', item })}
                    >
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => setPendingAction({ type: 'reject', item })}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-secondary">Processed</span>
                ),
            },
          ]}
          data={incomingTransactions}
          rowKey={(item) => item.id}
          emptyTitle="No blockchain detections"
          emptyDescription="Detected incoming deposits will appear here."
        />
      </Panel>

      <ConfirmDialog
        open={Boolean(pendingAction) && pendingAction !== null && canDecideTransaction(pendingAction.item)}
        title={pendingAction ? `${pendingAction.type === 'approve' ? 'Approve' : 'Reject'} transaction` : ''}
        description={
          pendingAction
            ? pendingAction.type === 'approve'
              ? pendingAction.item.type === 'DEPOSIT'
                ? `Approving this verified deposit will credit ${formatCurrency(pendingAction.item.amount)} to the client account.`
                : `Approving this withdrawal will debit ${formatCurrency(pendingAction.item.amount)} from the client account and move it into the payout flow.`
              : pendingAction.item.type === 'DEPOSIT'
                ? `Rejecting this deposit will leave the transfer recorded without crediting the client account.`
                : 'Rejecting this withdrawal will cancel the request and return any already-approved debit.'
            : ''
        }
        confirmLabel={pendingAction?.type === 'approve' ? 'Approve' : 'Reject'}
        tone={pendingAction?.type === 'reject' ? 'danger' : 'primary'}
        onCancel={() => {
          setPendingAction(null);
          setReason('');
        }}
        onConfirm={() => void confirmAction()}
      >
        <Input
          label="Decision reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional decision note"
        />
      </ConfirmDialog>
    </div>
  );
}
