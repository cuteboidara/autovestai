'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { formatDateTime, formatUsdt } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { ReconciliationRun } from '@/types/reconciliation';

function formatOptionalUsdt(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--';
  }

  return formatUsdt(value);
}

function formatOptionalDateTime(value: string | null | undefined) {
  return value ? formatDateTime(value) : '--';
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

export default function AdminReconciliationPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [latestRun, setLatestRun] = useState<ReconciliationRun | null>(null);
  const [runs, setRuns] = useState<ReconciliationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ReconciliationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const canViewReconciliation = hasPermission('treasury.view');
  const canManageReconciliation = hasPermission('treasury.manage');

  async function loadReconciliation(nextSelectedRunId?: string) {
    setLoading(true);

    try {
      const [latestResponse, runsResponse] = await Promise.all([
        adminApi.getReconciliationLatest(),
        adminApi.listReconciliationRuns(),
      ]);

      setLatestRun(latestResponse);
      setRuns(runsResponse);

      const preferredRun =
        runsResponse.find((run) => run.id === nextSelectedRunId) ??
        (latestResponse
          ? runsResponse.find((run) => run.id === latestResponse.id) ?? latestResponse
          : runsResponse[0] ?? null);

      setSelectedRun(preferredRun ?? null);
    } catch (error) {
      pushNotification({
        title: 'Reconciliation load failed',
        description:
          error instanceof Error ? error.message : 'Reconciliation request failed',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canViewReconciliation) {
      return;
    }

    let active = true;

    void (async () => {
      if (!active) {
        return;
      }

      await loadReconciliation();
    })();

    return () => {
      active = false;
    };
  }, [canViewReconciliation]);

  async function handleRunReconciliation() {
    if (!canManageReconciliation) {
      return;
    }

    setRunning(true);

    try {
      const run = await adminApi.runReconciliation();
      pushNotification({
        title: 'Reconciliation completed',
        description: `Run recorded with ${run.status} status.`,
        type: run.status === 'ERROR' ? 'error' : 'success',
      });
      await loadReconciliation(run.id);
    } catch (error) {
      pushNotification({
        title: 'Reconciliation run failed',
        description:
          error instanceof Error ? error.message : 'Reconciliation request failed',
        type: 'error',
      });
    } finally {
      setRunning(false);
    }
  }

  if (!canViewReconciliation) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Reconciliation"
          title="Reconciliation Console"
          description="Owner control surface for treasury match health, run history, and operational deficit detection."
        />
        <PermissionDenied
          title="Reconciliation unavailable"
          description="This admin account does not have permission to view reconciliation runs."
          requiredPermission="treasury.view"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reconciliation"
        title="Reconciliation Console"
        description="Owner control surface for treasury match health, snapshot staleness, pending outflow risk, and reconciliation run history."
        actions={
          <Button
            variant="secondary"
            onClick={() => void loadReconciliation(selectedRun?.id)}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {latestRun?.status === 'ERROR' ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-red-900">Reconciliation is in error state</p>
              <p className="mt-1 text-sm text-red-700">
                Latest run indicates treasury, liability, or approved outflow risk that needs owner action.
              </p>
            </div>
            <StatusBadge value={latestRun.status} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Treasury Balance"
          value={formatOptionalUsdt(latestRun?.treasuryBalance)}
          helper={
            latestRun
              ? `Snapshot ${formatOptionalDateTime(latestRun.latestTreasuryBalanceSnapshot?.observedAt)}`
              : undefined
          }
        />
        <StatCard
          label="Client Liabilities"
          value={formatOptionalUsdt(latestRun?.internalClientLiabilities)}
        />
        <StatCard
          label="Gross Difference"
          value={
            <span className={getDifferenceTone(latestRun?.grossDifference)}>
              {formatOptionalUsdt(latestRun?.grossDifference)}
            </span>
          }
          helper={latestRun ? latestRun.formulas.grossDifference : undefined}
        />
        <StatCard
          label="Operational Difference"
          value={
            <span className={getDifferenceTone(latestRun?.operationalDifference)}>
              {formatOptionalUsdt(latestRun?.operationalDifference)}
            </span>
          }
          helper={latestRun ? latestRun.formulas.operationalDifference : undefined}
        />
        <StatCard
          label="Pending Withdrawals"
          value={formatOptionalUsdt(latestRun?.pendingWithdrawalsTotal)}
          helper={
            latestRun
              ? `${formatOptionalUsdt(latestRun.approvedButNotSentWithdrawalsTotal)} approved not sent`
              : undefined
          }
        />
        <StatCard
          label="Latest Status"
          value={<StatusBadge value={latestRun?.status} />}
          helper={latestRun ? `${latestRun.warningCount} warning(s)` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel
          title="Run Reconciliation"
          description="Gross difference compares treasury balance to liabilities. Operational difference also subtracts approved withdrawals not yet sent."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="label-eyebrow">Latest run</p>
                <p className="mt-2 text-sm font-medium text-primary">
                  {formatOptionalDateTime(latestRun?.createdAt)}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="label-eyebrow">Source</p>
                <div className="mt-2">
                  <StatusBadge value={latestRun?.source} />
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="label-eyebrow">Tolerance</p>
                <p className="mt-2 text-sm font-medium text-primary">
                  {latestRun ? formatUsdt(latestRun.toleranceUsed) : '--'}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="label-eyebrow">Treasury wallet</p>
                <p className="mt-2 break-all font-mono text-xs text-primary">
                  {latestRun?.treasuryWalletAddress ?? 'Not configured'}
                </p>
              </div>
            </div>

            {canManageReconciliation ? (
              <Button onClick={() => void handleRunReconciliation()} disabled={running || loading}>
                Run reconciliation now
              </Button>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                Missing permission: <span className="font-mono">treasury.manage</span>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Current Warnings" description="Latest structured warnings raised by the reconciliation engine.">
          {latestRun?.warnings.length ? (
            <div className="space-y-3">
              {latestRun.warnings.map((warning) => (
                <div
                  key={`${latestRun.id}-${warning.code}`}
                  className={
                    warning.severity === 'critical'
                      ? 'rounded-2xl border border-red-200 bg-red-50 p-4'
                      : 'rounded-2xl border border-amber-200 bg-amber-50 p-4'
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p
                        className={
                          warning.severity === 'critical'
                            ? 'font-medium text-red-900'
                            : 'font-medium text-amber-900'
                        }
                      >
                        {warning.title}
                      </p>
                      <p
                        className={
                          warning.severity === 'critical'
                            ? 'mt-1 text-sm text-red-700'
                            : 'mt-1 text-sm text-amber-700'
                        }
                      >
                        {warning.detail}
                      </p>
                    </div>
                    <StatusBadge value={warning.severity} />
                  </div>
                  <p
                    className={
                      warning.severity === 'critical'
                        ? 'mt-2 text-xs uppercase tracking-[0.16em] text-red-700'
                        : 'mt-2 text-xs uppercase tracking-[0.16em] text-amber-700'
                    }
                  >
                    {warning.code.replaceAll('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              No active reconciliation warnings.
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Reconciliation History" description="Persisted runs for trend review and owner oversight.">
          <DataTable
            columns={[
              {
                key: 'createdAt',
                header: 'Time',
                render: (item) => formatDateTime(item.createdAt),
              },
              {
                key: 'source',
                header: 'Source',
                render: (item) => <StatusBadge value={item.source} />,
              },
              {
                key: 'treasuryBalance',
                header: 'Treasury',
                align: 'right',
                render: (item) => formatOptionalUsdt(item.treasuryBalance),
              },
              {
                key: 'liabilities',
                header: 'Liabilities',
                align: 'right',
                render: (item) => formatUsdt(item.internalClientLiabilities),
              },
              {
                key: 'grossDifference',
                header: 'Gross Diff',
                align: 'right',
                render: (item) => (
                  <span className={getDifferenceTone(item.grossDifference)}>
                    {formatOptionalUsdt(item.grossDifference)}
                  </span>
                ),
              },
              {
                key: 'operationalDifference',
                header: 'Operational Diff',
                align: 'right',
                render: (item) => (
                  <span className={getDifferenceTone(item.operationalDifference)}>
                    {formatOptionalUsdt(item.operationalDifference)}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => <StatusBadge value={item.status} />,
              },
              {
                key: 'warningCount',
                header: 'Warnings',
                align: 'right',
                render: (item) => item.warningCount,
              },
            ]}
            data={runs}
            rowKey={(item) => item.id}
            onRowClick={(item) => setSelectedRun(item)}
            rowClassName={(item) =>
              selectedRun?.id === item.id ? 'bg-page' : undefined
            }
            emptyTitle="No reconciliation runs"
            emptyDescription="Run reconciliation manually or enable scheduled runs to build history."
          />
        </Panel>

        <Panel
          title="Selected Run"
          description="Detailed metrics, warnings, and references for the currently selected reconciliation run."
        >
          {selectedRun ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">Snapshot reference</p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {selectedRun.latestTreasuryBalanceSnapshotId ?? 'No snapshot'}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {formatOptionalDateTime(
                      selectedRun.latestTreasuryBalanceSnapshot?.observedAt,
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">Initiated by</p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {selectedRun.initiatedByUser?.email ?? 'system'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">Gross formula</p>
                  <p className="mt-2 font-mono text-xs text-primary">
                    {selectedRun.formulas.grossDifference}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-page p-4">
                  <p className="label-eyebrow">Operational formula</p>
                  <p className="mt-2 font-mono text-xs text-primary">
                    {selectedRun.formulas.operationalDifference}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['Treasury balance', formatOptionalUsdt(selectedRun.treasuryBalance)],
                  ['Client liabilities', formatUsdt(selectedRun.internalClientLiabilities)],
                  ['Pending deposits', formatUsdt(selectedRun.pendingDepositsTotal)],
                  ['Pending withdrawals', formatUsdt(selectedRun.pendingWithdrawalsTotal)],
                  ['Approved not sent', formatUsdt(selectedRun.approvedButNotSentWithdrawalsTotal)],
                  ['Tolerance used', formatUsdt(selectedRun.toleranceUsed)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-page p-4">
                    <p className="label-eyebrow">{label}</p>
                    <p className="mt-2 text-sm font-medium text-primary">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border bg-page p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="label-eyebrow">Status</p>
                    <p className="mt-2 text-sm text-secondary">
                      Recorded {formatOptionalDateTime(selectedRun.createdAt)}
                    </p>
                  </div>
                  <StatusBadge value={selectedRun.status} />
                </div>
              </div>

              {selectedRun.warnings.length ? (
                <div className="space-y-3">
                  {selectedRun.warnings.map((warning) => (
                    <div
                      key={`${selectedRun.id}-${warning.code}`}
                      className="rounded-2xl border border-border bg-page p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-primary">{warning.title}</p>
                        <StatusBadge value={warning.severity} />
                      </div>
                      <p className="mt-2 text-sm text-secondary">{warning.detail}</p>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
                        {warning.code.replaceAll('_', ' ')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                  No warnings on this run.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-page p-4 text-sm text-secondary">
              Select a reconciliation run to inspect its metrics and warnings.
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
