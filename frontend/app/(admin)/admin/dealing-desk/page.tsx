'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { dealingDeskApi } from '@/services/api/dealing-desk';
import { useNotificationStore } from '@/store/notification-store';
import { useAdminStore } from '@/store/admin-store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { HedgeAction } from '@/types/admin';

export default function DealingDeskPage() {
  const { hasPermission } = useAuth();
  const exposure = useAdminStore((state) => state.exposure);
  const hedgeActions = useAdminStore((state) => state.hedgeActions);
  const setExposure = useAdminStore((state) => state.setExposure);
  const setHedgeActions = useAdminStore((state) => state.setHedgeActions);
  const pushNotification = useNotificationStore((state) => state.push);
  const [pendingAction, setPendingAction] = useState<{
    type: 'approve' | 'reject';
    item: HedgeAction;
  } | null>(null);
  const canManageDealingDesk = hasPermission('dealingdesk.manage');

  async function refreshRisk() {
    const [exposureData, actionData] = await Promise.all([
      dealingDeskApi.getExposure(),
      dealingDeskApi.getHedgeActions(),
    ]);

    setExposure(exposureData);
    setHedgeActions(actionData);
  }

  useEffect(() => {
    if (!canManageDealingDesk) {
      return;
    }

    void refreshRisk();
  }, [canManageDealingDesk]);

  if (!canManageDealingDesk) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Dealing Desk"
          title="Exposure and hedge suggestions"
          description="Broker-side exposure concentration, floating impact, and manual hedge suggestion controls."
        />
        <PermissionDenied
          title="Dealing desk unavailable"
          description="This admin account does not have permission to manage dealing desk exposure."
          requiredPermission="dealingdesk.manage"
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
        await dealingDeskApi.approveHedgeAction(pendingAction.item.id);
      } else {
        await dealingDeskApi.rejectHedgeAction(pendingAction.item.id);
      }

      pushNotification({
        title: `Hedge action ${pendingAction.type}d`,
        description: `${pendingAction.item.symbol} ${pendingAction.item.actionType} updated.`,
        type: 'success',
      });
      setPendingAction(null);
      await refreshRisk();
    } catch (error) {
      pushNotification({
        title: 'Hedge action update failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dealing Desk"
        title="Dealing Desk"
        description="Broker-side exposure concentration, floating impact, and manual hedge suggestion controls."
      />

      <Panel title="Hedge Suggestions" description="Approve or reject broker hedge suggestions.">
        <div className="space-y-3">
          {hedgeActions.map((action) => (
            <div key={action.id} className="rounded-2xl border border-border bg-page p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-primary">
                    {action.symbol} {action.actionType}
                  </p>
                  <p className="mt-1 text-sm text-secondary">{action.reason}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted">
                    {formatDateTime(action.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={action.status} />
                  {action.status === 'SUGGESTED' ? (
                    <>
                      <Button variant="secondary" onClick={() => setPendingAction({ type: 'approve', item: action })}>
                        Approve
                      </Button>
                      <Button variant="danger" onClick={() => setPendingAction({ type: 'reject', item: action })}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Exposure Table" description="Long, short, net, and top-client concentration per symbol.">
        <DataTable
          columns={[
            {
              key: 'symbol',
              header: 'Symbol',
              render: (item) => <span className="font-medium text-primary">{item.symbol}</span>,
            },
            { key: 'long', header: 'Long Vol', align: 'right', render: (item) => item.longVolume },
            { key: 'short', header: 'Short Vol', align: 'right', render: (item) => item.shortVolume },
            { key: 'net', header: 'Net', align: 'right', render: (item) => item.netVolume },
            {
              key: 'floating',
              header: 'Floating PnL',
              align: 'right',
              render: (item) => formatCurrency(item.floatingPnlImpactEstimate),
            },
            {
              key: 'concentration',
              header: 'Top Concentration',
              render: (item) =>
                item.topClients[0]
                  ? `${item.topClients[0].email} / ${item.topClients[0].volume}`
                  : '--',
            },
          ]}
          data={exposure}
          rowKey={(item) => item.symbol}
          emptyTitle="No exposure data"
          emptyDescription="Exposure calculations will appear here when positions are open."
        />
      </Panel>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction ? `${pendingAction.type === 'approve' ? 'Approve' : 'Reject'} hedge action` : ''}
        description={
          pendingAction
            ? `${pendingAction.item.symbol} ${pendingAction.item.actionType} will be marked ${pendingAction.type}d.`
            : ''
        }
        confirmLabel={pendingAction?.type === 'approve' ? 'Approve' : 'Reject'}
        tone={pendingAction?.type === 'reject' ? 'danger' : 'primary'}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmAction()}
      />
    </div>
  );
}
