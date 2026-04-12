'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatUsdt } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import {
  TreasuryBalanceSnapshot,
  TreasuryLiabilitiesBreakdown,
  TreasuryMovement,
  TreasuryReconciliationReport,
  TreasurySummary,
} from '@/types/treasury';

type TreasuryMovementFilters = {
  type: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  user: string;
  txHash: string;
};

function getTodayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatOptionalUsdt(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  return formatUsdt(value);
}

function formatOptionalDateTime(value: string | null | undefined) {
  return value ? formatDateTime(value) : '--';
}

function buildMovementQuery(filters: TreasuryMovementFilters): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value.trim().length > 0),
  );
}

function getDifferenceTone(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return 'text-primary';
  }

  if (value < 0) {
    return 'text-red-600';
  }

  if (value > 0) {
    return 'text-emerald-600';
  }

  return 'text-primary';
}

export default function AdminTreasuryPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [reconciliation, setReconciliation] = useState<TreasuryReconciliationReport | null>(null);
  const [movements, setMovements] = useState<TreasuryMovement[]>([]);
  const [snapshots, setSnapshots] = useState<TreasuryBalanceSnapshot[]>([]);
  const [liabilitiesBreakdown, setLiabilitiesBreakdown] =
    useState<TreasuryLiabilitiesBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [movementFilters, setMovementFilters] = useState<TreasuryMovementFilters>({
    type: '',
    status: '',
    dateFrom: getTodayInputValue(),
    dateTo: getTodayInputValue(),
    user: '',
    txHash: '',
  });
  const [snapshotForm, setSnapshotForm] = useState({
    balance: '',
    observedAt: '',
    sourceNote: '',
  });
  const canViewTreasury = hasPermission('treasury.view');
  const canManageTreasury = hasPermission('treasury.manage');

  async function loadTreasury(nextFilters: TreasuryMovementFilters = movementFilters) {
    setLoading(true);

    try {
      const [summaryResponse, reconciliationResponse, movementResponse, snapshotResponse, liabilitiesResponse] =
        await Promise.all([
          adminApi.getTreasurySummary(),
          adminApi.getTreasuryReconciliation(),
          adminApi.listTreasuryMovements(buildMovementQuery(nextFilters)),
          adminApi.listTreasuryBalanceSnapshots(12),
          adminApi.getTreasuryLiabilitiesBreakdown(),
        ]);

      setSummary(summaryResponse);
      setReconciliation(reconciliationResponse);
      setMovements(movementResponse);
      setSnapshots(snapshotResponse);
      setLiabilitiesBreakdown(liabilitiesResponse);
    } catch (error) {
      pushNotification({
        title: 'Treasury load failed',
        description: error instanceof Error ? error.message : 'Treasury request failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canViewTreasury) {
      return;
    }

    let active = true;

    void (async () => {
      if (!active) {
        return;
      }

      await loadTreasury();
    })();

    return () => {
      active = false;
    };
  }, [canViewTreasury]);

  async function handleSnapshotSubmit() {
    if (!canManageTreasury) {
      return;
    }

    try {
      await adminApi.createTreasuryBalanceSnapshot({
        balance: Number(snapshotForm.balance),
        observedAt: snapshotForm.observedAt
          ? new Date(snapshotForm.observedAt).toISOString()
          : undefined,
        sourceNote: snapshotForm.sourceNote || undefined,
      });
      pushNotification({
        title: 'Treasury snapshot recorded',
        description: 'Manual treasury balance snapshot saved.',
        type: 'success',
      });
      setSnapshotForm({
        balance: '',
        observedAt: '',
        sourceNote: '',
      });
      await loadTreasury();
    } catch (error) {
      pushNotification({
        title: 'Snapshot failed',
        description: error instanceof Error ? error.message : 'Treasury snapshot request failed',
        type: 'error',
      });
    }
  }

  async function handleCopyWalletAddress() {
    if (!summary?.walletAddress) {
      return;
    }

    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard is unavailable in this browser');
      }

      await navigator.clipboard.writeText(summary.walletAddress);
      pushNotification({
        title: 'Treasury wallet copied',
        description: 'Treasury wallet address copied to clipboard.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Copy failed',
        description: error instanceof Error ? error.message : 'Clipboard request failed',
        type: 'error',
      });
    }
  }

  if (!canViewTreasury) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Treasury"
          title="Treasury Dashboard"
          description="Owner-level custody visibility, liabilities, pending flows, and reconciliation status."
        />
        <PermissionDenied
          title="Treasury unavailable"
          description="This admin account does not have permission to view treasury operations."
          requiredPermission="treasury.view"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Treasury"
        title="Treasury Dashboard"
        description="Owner-level custody visibility for observed treasury balances, client liabilities, pending cash flows, and reconciliation drift."
        actions={
          <Button variant="secondary" onClick={() => void loadTreasury()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="On-chain Treasury"
          value={formatOptionalUsdt(summary?.onChainBalance)}
          helper={
            summary ? (
              <div className="space-y-1">
                <div>{summary.liveBalanceAvailable ? 'Live API balance' : 'No live balance available'}</div>
                <div>Last checked {formatOptionalDateTime(summary.lastCheckedAt)}</div>
              </div>
            ) : undefined
          }
        />
        <StatCard
          label="Client Liabilities"
          value={formatOptionalUsdt(summary?.internalClientLiabilities)}
        />
        <StatCard
          label="Pending Withdrawals"
          value={formatOptionalUsdt(summary?.pendingWithdrawalsTotal)}
          helper={
            summary
              ? `${formatOptionalUsdt(summary.approvedButNotSentWithdrawalsTotal)} approved not sent`
              : undefined
          }
        />
        <StatCard
          label="Pending Deposits"
          value={formatOptionalUsdt(summary?.pendingDepositsTotal)}
        />
        <StatCard
          label="Reconciliation Diff"
          value={
            <span className={getDifferenceTone(summary?.reconciliationDifference)}>
              {formatOptionalUsdt(summary?.reconciliationDifference)}
            </span>
          }
          helper={
            summary
              ? `Operating surplus ${formatOptionalUsdt(summary.availableOperatingSurplusDeficit)}`
              : undefined
          }
        />
        <StatCard
          label="Reconciliation Status"
          value={<StatusBadge value={summary?.reconciliationStatus} />}
          helper={summary ? `${summary.warnings.length} active warning(s)` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel
          title="Treasury Wallet"
          description="Configured alpha custody wallet and monitoring mode."
          actions={
            summary?.walletAddress ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void handleCopyWalletAddress()}>
                  Copy address
                </Button>
                {summary.explorerUrl ? (
                  <Button variant="secondary" asChild>
                    <a href={summary.explorerUrl} target="_blank" rel="noreferrer">
                      Open explorer
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-page p-4">
              <p className="label-eyebrow">Wallet Address</p>
              <p className="mt-2 break-all font-mono text-sm text-primary">
                {summary?.walletAddress ?? 'Treasury wallet is not configured'}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['Asset', summary?.asset ?? '--'],
                ['Network', summary?.network ?? '--'],
                ['Monitoring', summary?.monitoringMode ?? '--'],
                ['Last Checked', formatOptionalDateTime(summary?.lastCheckedAt)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">{label}</p>
                  <p className="mt-2 text-sm font-medium text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Reconciliation" description="Observed chain balance against internal liabilities and pending outflows.">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Chain balance', formatOptionalUsdt(summary?.onChainBalance)],
              ['Client liabilities', formatOptionalUsdt(summary?.internalClientLiabilities)],
              ['Pending withdrawals', formatOptionalUsdt(summary?.pendingWithdrawalsTotal)],
              ['Net treasury after outflows', formatOptionalUsdt(summary?.netTreasuryAfterPendingOutflows)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-border bg-page p-4">
                <p className="label-eyebrow">{label}</p>
                <p className="mt-2 text-sm font-medium text-primary">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-border bg-page p-4">
            <div>
              <p className="label-eyebrow">Status</p>
              <p className="mt-2 text-sm text-secondary">
                Generated {formatOptionalDateTime(reconciliation?.generatedAt)}
              </p>
            </div>
            <StatusBadge value={reconciliation?.status ?? summary?.reconciliationStatus} />
          </div>

          <div className="mt-4 space-y-3">
            {(reconciliation?.warnings ?? summary?.warnings ?? []).length > 0 ? (
              (reconciliation?.warnings ?? summary?.warnings ?? []).map((warning) => (
                <div
                  key={warning.code}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-amber-900">{warning.message}</p>
                    <StatusBadge value={warning.severity} />
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-amber-700">
                    {warning.code.replaceAll('_', ' ')}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                No reconciliation warnings.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="Balance Snapshot Form" description="Record a manual observed treasury balance for alpha reconciliation.">
          {canManageTreasury ? (
            <div className="space-y-4">
              <Input
                label="Observed balance"
                type="number"
                min="0"
                step="0.00000001"
                value={snapshotForm.balance}
                onChange={(event) =>
                  setSnapshotForm((current) => ({
                    ...current,
                    balance: event.target.value,
                  }))
                }
                placeholder="0.00"
              />
              <Input
                label="Observed at"
                type="datetime-local"
                value={snapshotForm.observedAt}
                onChange={(event) =>
                  setSnapshotForm((current) => ({
                    ...current,
                    observedAt: event.target.value,
                  }))
                }
              />
              <Input
                label="Source note"
                value={snapshotForm.sourceNote}
                onChange={(event) =>
                  setSnapshotForm((current) => ({
                    ...current,
                    sourceNote: event.target.value,
                  }))
                }
                placeholder="Manual wallet check"
              />
              <Button
                onClick={() => void handleSnapshotSubmit()}
                disabled={!snapshotForm.balance || loading}
              >
                Record snapshot
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Missing permission: <span className="font-mono">treasury.manage</span>
            </div>
          )}
        </Panel>

        <Panel title="Recent Balance Snapshots" description="Latest observed treasury balances used for reconciliation history.">
          <DataTable
            columns={[
              {
                key: 'observedAt',
                header: 'Observed',
                render: (item) => formatDateTime(item.observedAt),
              },
              {
                key: 'balance',
                header: 'Balance',
                align: 'right',
                render: (item) => formatUsdt(item.balance),
              },
              {
                key: 'source',
                header: 'Source',
                render: (item) => <StatusBadge value={item.source} />,
              },
              {
                key: 'recordedBy',
                header: 'Recorded by',
                render: (item) => item.createdByUser?.email ?? 'system',
              },
            ]}
            data={snapshots}
            rowKey={(item) => item.id}
            emptyTitle="No treasury snapshots"
            emptyDescription="Recorded balance snapshots will appear here."
          />
        </Panel>
      </div>

      <Panel
        title="Treasury Movements"
        description="Deposits and withdrawals affecting treasury review, filtered for owner operations."
        actions={
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Input
              label="Date from"
              type="date"
              value={movementFilters.dateFrom}
              onChange={(event) =>
                setMovementFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
            <Input
              label="Date to"
              type="date"
              value={movementFilters.dateTo}
              onChange={(event) =>
                setMovementFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
            <Select
              label="Type"
              value={movementFilters.type}
              onChange={(event) =>
                setMovementFilters((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
            >
              <option value="">All types</option>
              <option value="DEPOSIT">Deposit</option>
              <option value="WITHDRAW">Withdraw</option>
            </Select>
            <Select
              label="Status"
              value={movementFilters.status}
              onChange={(event) =>
                setMovementFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="COMPLETED">Completed</option>
            </Select>
            <Input
              label="User"
              value={movementFilters.user}
              onChange={(event) =>
                setMovementFilters((current) => ({
                  ...current,
                  user: event.target.value,
                }))
              }
              placeholder="Email or user ID"
            />
            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={() => void loadTreasury(movementFilters)}
                disabled={loading}
                className="w-full"
              >
                Apply filters
              </Button>
            </div>
          </div>
        }
      >
        <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-page p-4">
            <p className="label-eyebrow">Today in</p>
            <p className="mt-2 text-lg font-semibold text-emerald-600">
              {formatUsdt(
                movements
                  .filter((item) => item.type === 'DEPOSIT')
                  .reduce((sum, item) => sum + item.amount, 0),
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-page p-4">
            <p className="label-eyebrow">Today out</p>
            <p className="mt-2 text-lg font-semibold text-red-600">
              {formatUsdt(
                movements
                  .filter((item) => item.type === 'WITHDRAW')
                  .reduce((sum, item) => sum + item.amount, 0),
              )}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-page p-4">
            <p className="label-eyebrow">Approved not sent</p>
            <p className="mt-2 text-lg font-semibold text-primary">
              {formatOptionalUsdt(summary?.approvedButNotSentWithdrawalsTotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-page p-4">
            <p className="label-eyebrow">Rows loaded</p>
            <p className="mt-2 text-lg font-semibold text-primary">{movements.length}</p>
          </div>
        </div>

        <DataTable
          columns={[
            {
              key: 'createdAt',
              header: 'Time',
              render: (item) => formatDateTime(item.createdAt),
            },
            {
              key: 'type',
              header: 'Type',
              render: (item) => <StatusBadge value={item.type} />,
            },
            {
              key: 'user',
              header: 'User',
              render: (item) => (
                <div>
                  <p className="font-medium text-primary">{item.userEmail ?? item.userId}</p>
                  <p className="text-xs text-secondary">{item.userId}</p>
                </div>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              render: (item) => formatUsdt(item.amount),
            },
            {
              key: 'asset',
              header: 'Asset',
              render: (item) => item.asset,
            },
            {
              key: 'network',
              header: 'Network',
              render: (item) => item.network ?? '--',
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => <StatusBadge value={item.status} />,
            },
            {
              key: 'txHash',
              header: 'Tx Hash',
              render: (item) =>
                item.txHash ? (
                  item.explorerUrl ? (
                    <a
                      href={item.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-accent hover:text-[#D99E1E]"
                    >
                      {item.txHash}
                    </a>
                  ) : (
                    <span className="font-mono text-xs text-primary">{item.txHash}</span>
                  )
                ) : (
                  '--'
                ),
            },
          ]}
          data={movements}
          rowKey={(item) => item.id}
          emptyTitle="No treasury movements"
          emptyDescription="Treasury-relevant deposits and withdrawals will appear here."
        />
      </Panel>

      {liabilitiesBreakdown ? (
        <Panel title="Liabilities Breakdown" description="Largest wallet balances and concentration risk across active funded users.">
          <div className="mb-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-page p-4">
              <p className="label-eyebrow">Total liabilities</p>
              <p className="mt-2 text-lg font-semibold text-primary">
                {formatUsdt(liabilitiesBreakdown.totalLiabilities)}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-page p-4">
              <p className="label-eyebrow">Funded users</p>
              <p className="mt-2 text-lg font-semibold text-primary">
                {liabilitiesBreakdown.totalActiveUsersWithBalance}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-page p-4">
              <p className="label-eyebrow">Top 5 concentration</p>
              <p className="mt-2 text-lg font-semibold text-primary">
                {liabilitiesBreakdown.concentrationPercentageTop5.toFixed(2)}%
              </p>
            </div>
          </div>

          <DataTable
            columns={[
              {
                key: 'email',
                header: 'User',
                render: (item) => (
                  <div>
                    <p className="font-medium text-primary">{item.email}</p>
                    <p className="text-xs text-secondary">{item.userId}</p>
                  </div>
                ),
              },
              {
                key: 'balance',
                header: 'Balance',
                align: 'right',
                render: (item) => formatUsdt(item.balance),
              },
              {
                key: 'concentration',
                header: 'Share',
                align: 'right',
                render: (item) => `${item.concentrationPercentage.toFixed(2)}%`,
              },
            ]}
            data={liabilitiesBreakdown.topUsers}
            rowKey={(item) => item.userId}
            emptyTitle="No client liabilities"
            emptyDescription="Users with funded wallets will appear here."
          />
        </Panel>
      ) : null}
    </div>
  );
}
