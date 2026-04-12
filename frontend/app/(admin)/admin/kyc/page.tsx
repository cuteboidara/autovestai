'use client';

import { useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { kycApi } from '@/services/api/kyc';
import { useNotificationStore } from '@/store/notification-store';
import { formatDateTime } from '@/lib/utils';
import { KycSubmission } from '@/types/kyc';

export default function AdminKycPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [items, setItems] = useState<KycSubmission[]>([]);
  const [selected, setSelected] = useState<KycSubmission | null>(null);
  const [reason, setReason] = useState('');
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const canReviewKyc = hasPermission('kyc.approve');

  async function refreshKyc() {
    const response = await kycApi.listAdmin();
    setItems(response);
    if (selected) {
      const detail = await kycApi.getAdminDetail(selected.id ?? '');
      setSelected(detail);
    }
  }

  useEffect(() => {
    if (!canReviewKyc) {
      return;
    }

    void refreshKyc();
  }, [canReviewKyc]);

  if (!canReviewKyc) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="KYC Review"
          title="Manual compliance queue"
          description="Review pending KYC submissions, inspect fields, and approve or reject with reason."
        />
        <PermissionDenied
          title="KYC review unavailable"
          description="This admin account does not have permission to review KYC submissions."
          requiredPermission="kyc.approve"
        />
      </div>
    );
  }

  async function chooseSubmission(id: string) {
    const detail = await kycApi.getAdminDetail(id);
    setSelected(detail);
  }

  async function confirmDecision() {
    if (!selected?.id || !dialog) {
      return;
    }

    try {
      if (dialog === 'approve') {
        await kycApi.approve(selected.id);
      } else {
        await kycApi.reject(selected.id, reason);
      }

      pushNotification({
        title: `KYC ${dialog}d`,
        description: `${selected.user?.email ?? selected.id} updated successfully.`,
        type: 'success',
      });
      setDialog(null);
      setReason('');
      await refreshKyc();
    } catch (error) {
      pushNotification({
        title: 'KYC decision failed',
        description: error instanceof Error ? error.message : 'Decision failed',
        type: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="KYC Review"
        title="KYC Queue"
        description="Review pending KYC submissions, inspect fields, and approve or reject with reason."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="KYC Queue" description="Latest submissions in the review queue.">
          <DataTable
            columns={[
              {
                key: 'user',
                header: 'User',
                render: (item) => <span className="font-medium text-primary">{item.user?.email ?? item.fullName}</span>,
              },
              {
                key: 'submitted',
                header: 'Submitted',
                render: (item) => formatDateTime(item.createdAt ?? ''),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => <StatusBadge value={item.status} />,
              },
            ]}
            data={items}
            rowKey={(item) => item.id ?? item.userId ?? item.createdAt ?? ''}
            onRowClick={(item) => void chooseSubmission(item.id ?? '')}
            emptyTitle="No KYC submissions"
            emptyDescription="Pending KYC cases will appear here."
          />
        </Panel>

        <Panel title="Submission Detail" description="Review submitted fields and decide.">
          {selected ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-border bg-page p-4">
                <p className="text-lg font-semibold text-primary">{selected.fullName}</p>
                <p className="mt-1 text-sm text-secondary">{selected.user?.email}</p>
                <div className="mt-3">
                  <StatusBadge value={selected.status} />
                </div>
                {selected.rejectionReason ? (
                  <p className="mt-3 text-sm text-danger">{selected.rejectionReason}</p>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ['Date of birth', selected.dateOfBirth],
                  ['Country', selected.country],
                  ['City', selected.city],
                  ['Postal code', selected.postalCode],
                  ['Document type', selected.documentType],
                  ['Document number', selected.documentNumber],
                  ['Address', selected.addressLine1],
                  ['Front URL', selected.documentFrontUrl ?? '--'],
                  ['Back URL', selected.documentBackUrl ?? '--'],
                  ['Selfie URL', selected.selfieUrl ?? '--'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-page p-4">
                    <p className="label-eyebrow">{label}</p>
                    <p className="mt-2 break-all text-sm text-primary">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setDialog('approve')}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => setDialog('reject')}>
                  Reject
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-secondary">Select a KYC case to review.</p>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog === 'approve' ? 'Approve KYC case' : 'Reject KYC case'}
        description={
          dialog === 'approve'
            ? 'This submission will be marked approved.'
            : 'Rejection requires a reason and will update the client status.'
        }
        confirmLabel={dialog === 'approve' ? 'Approve' : 'Reject'}
        tone={dialog === 'reject' ? 'danger' : 'primary'}
        onCancel={() => {
          setDialog(null);
          setReason('');
        }}
        onConfirm={() => void confirmDecision()}
      >
        {dialog === 'reject' ? (
          <Input
            label="Rejection reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
