'use client';

import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { dealingDeskApi } from '@/services/api/dealing-desk';
import { useNotificationStore } from '@/store/notification-store';
import {
  AdminExposure,
  AdminOpenPosition,
  FailedQueueJobRecord,
  HedgeAction,
} from '@/types/admin';
import { formatDateTime, formatNumber } from '@/lib/utils';

export default function AdminRiskPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [exposure, setExposure] = useState<AdminExposure[]>([]);
  const [hedgeActions, setHedgeActions] = useState<HedgeAction[]>([]);
  const [positions, setPositions] = useState<AdminOpenPosition[]>([]);
  const [failedJobs, setFailedJobs] = useState<FailedQueueJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingQueues, setRetryingQueues] = useState(false);
  const canViewRisk = hasPermission('risk.view');
  const canManageQueues = hasPermission('queues.manage');

  async function loadRiskState() {
    const [exposureItems, hedgeItems, positionItems, failedQueueJobs] =
      await Promise.all([
        dealingDeskApi.getExposure().catch(() => []),
        dealingDeskApi.getHedgeActions().catch(() => []),
        adminApi.listOpenPositions().catch(() => []),
        canManageQueues ? adminApi.listFailedQueueJobs().catch(() => []) : Promise.resolve([]),
      ]);

    setExposure(exposureItems);
    setHedgeActions(hedgeItems);
    setPositions(positionItems);
    setFailedJobs(failedQueueJobs);
  }

  useEffect(() => {
    if (!canViewRisk) {
      return;
    }

    let active = true;

    setLoading(true);
    void loadRiskState()
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load risk monitor',
          description: error instanceof Error ? error.message : 'Request failed',
          type: 'error',
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canManageQueues, canViewRisk, pushNotification]);

  const totalNetExposure = useMemo(
    () =>
      exposure.reduce(
        (sum, item) => sum + Math.abs(Number(item.netVolume ?? 0)),
        0,
      ),
    [exposure],
  );

  async function handleRetryQueues() {
    setRetryingQueues(true);

    try {
      const result = await adminApi.retryAllFailedQueueJobs();
      await loadRiskState();
      pushNotification({
        title: 'Failed queue jobs retried',
        description: `${result.retried}/${result.totalFailed} failed jobs were retried.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Queue retry failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setRetryingQueues(false);
    }
  }

  if (!canViewRisk) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Risk"
          title="Risk Monitor"
          description="Exposure, live positions, hedge recommendations, and queue pressure across the control tower."
        />
        <PermissionDenied
          title="Risk monitor unavailable"
          description="This admin account does not have permission to access the risk monitor."
          requiredPermission="risk.view"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Risk"
        title="Risk Monitor"
        description="Exposure, live positions, hedge recommendations, and queue pressure across the control tower."
        actions={
          canManageQueues ? (
            <Button
              variant="secondary"
              disabled={retryingQueues}
              onClick={() => void handleRetryQueues()}
            >
              {retryingQueues ? 'Retrying...' : 'Retry Failed Queues'}
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Symbols with exposure" value={exposure.length} />
        <StatCard label="Open positions" value={positions.length} />
        <StatCard label="Suggested hedges" value={hedgeActions.filter((item) => item.status === 'SUGGESTED').length} />
        <StatCard label="Failed queue jobs" value={failedJobs.length} helper={formatNumber(totalNetExposure, 2)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Exposure by Symbol"
          description="Current net client exposure and concentration by top accounts."
        >
          <DataTable
            columns={[
              {
                key: 'symbol',
                header: 'Symbol',
                render: (item) => <span className="font-medium text-primary">{item.symbol}</span>,
              },
              {
                key: 'long',
                header: 'Long',
                align: 'right',
                render: (item) => formatNumber(item.longVolume, 4),
              },
              {
                key: 'short',
                header: 'Short',
                align: 'right',
                render: (item) => formatNumber(item.shortVolume, 4),
              },
              {
                key: 'net',
                header: 'Net',
                align: 'right',
                render: (item) => formatNumber(item.netVolume, 4),
              },
            ]}
            data={exposure}
            rowKey={(item) => item.symbol}
            emptyTitle={loading ? 'Loading exposure...' : 'No risk exposure'}
            emptyDescription="Exposure snapshots appear here once open positions exist."
          />
        </Panel>

        <Panel
          title="Hedge Queue"
          description="Suggested and approved hedge actions from the dealing desk."
        >
          <div className="space-y-3">
            {loading ? (
              <p className="text-sm text-secondary">Loading hedge actions...</p>
            ) : hedgeActions.length === 0 ? (
              <p className="text-sm text-secondary">No hedge actions are queued.</p>
            ) : (
              hedgeActions.slice(0, 8).map((action) => (
                <div key={action.id} className="rounded-2xl border border-border bg-page p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-primary">
                        {action.symbol} {action.actionType}
                      </p>
                      <p className="mt-1 text-sm text-secondary">{action.reason}</p>
                    </div>
                    <StatusBadge value={action.status} />
                  </div>
                  <p className="mt-3 text-xs text-secondary">
                    {formatDateTime(action.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Live Positions"
        description="Open positions across client accounts for active risk supervision."
      >
        <DataTable
          columns={[
            {
              key: 'user',
              header: 'Client',
              render: (item) => item.email,
            },
            {
              key: 'account',
              header: 'Account',
              render: (item) => `${item.accountName} (${item.accountNo})`,
            },
            {
              key: 'symbol',
              header: 'Symbol',
              render: (item) => <span className="font-medium text-primary">{item.symbol}</span>,
            },
            { key: 'side', header: 'Side', render: (item) => item.side },
            {
              key: 'volume',
              header: 'Volume',
              align: 'right',
              render: (item) => formatNumber(item.volume, 4),
            },
            {
              key: 'openedAt',
              header: 'Opened',
              render: (item) => formatDateTime(item.openedAt),
            },
          ]}
          data={positions}
          rowKey={(item) => item.id}
          emptyTitle={loading ? 'Loading positions...' : 'No open positions'}
          emptyDescription="Open client positions appear here for risk monitoring."
        />
      </Panel>

      <Panel
        title="Failed Queue Jobs"
        description="Operational retries for order-execution jobs that need attention."
      >
        {canManageQueues ? (
          <DataTable
            columns={[
              {
                key: 'job',
                header: 'Job',
                render: (item) => (
                  <div>
                    <p className="font-medium text-primary">{item.name}</p>
                    <p className="text-xs text-secondary">{item.id}</p>
                  </div>
                ),
              },
              {
                key: 'attempts',
                header: 'Attempts',
                align: 'right',
                render: (item) => item.attemptsMade,
              },
              {
                key: 'failedReason',
                header: 'Reason',
                render: (item) => item.failedReason ?? '--',
              },
              {
                key: 'finishedOn',
                header: 'Failed At',
                render: (item) =>
                  item.finishedOn ? formatDateTime(new Date(item.finishedOn)) : '--',
              },
            ]}
            data={failedJobs}
            rowKey={(item) => item.id}
            emptyTitle={loading ? 'Loading queue health...' : 'No failed queue jobs'}
            emptyDescription="Queue failures appear here when automated order processing needs intervention."
          />
        ) : (
          <p className="text-sm text-secondary">
            Queue management is not enabled for this admin account.
          </p>
        )}
      </Panel>
    </div>
  );
}
