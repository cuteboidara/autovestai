'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, X, FileText } from 'lucide-react';

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

function isPdf(url: string) {
  return /\.pdf(\?|$)/i.test(url) || /\/pdf\//i.test(url);
}

function DocTile({ label, url, onPreview }: { label: string; url: string | null | undefined; onPreview: (url: string) => void }) {
  if (!url) {
    return (
      <div className="rounded-2xl border border-border bg-page p-4">
        <p className="label-eyebrow">{label}</p>
        <p className="mt-2 text-sm text-secondary">Not provided</p>
      </div>
    );
  }

  if (isPdf(url)) {
    return (
      <div className="rounded-2xl border border-border bg-page p-4">
        <p className="label-eyebrow">{label}</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-primary transition hover:bg-hover"
        >
          <FileText className="h-4 w-4 text-secondary" />
          View PDF
          <ExternalLink className="h-3.5 w-3.5 text-secondary" />
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-page p-4">
      <p className="label-eyebrow">{label}</p>
      <button
        type="button"
        className="mt-3 block w-full overflow-hidden rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-accent/40"
        onClick={() => onPreview(url)}
        title="Click to enlarge"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="h-40 w-full object-cover transition duration-150 hover:opacity-90"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      </button>
    </div>
  );
}

export default function AdminKycPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [items, setItems] = useState<KycSubmission[]>([]);
  const [selected, setSelected] = useState<KycSubmission | null>(null);
  const [reason, setReason] = useState('');
  const [dialog, setDialog] = useState<'approve' | 'reject' | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
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
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border bg-page p-4">
                    <p className="label-eyebrow">{label}</p>
                    <p className="mt-2 break-all text-sm text-primary">{value ?? '--'}</p>
                  </div>
                ))}
              </div>

              {/* Document images */}
              <div>
                <p className="label-eyebrow mb-3">Documents</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DocTile label="ID – Front" url={selected.documentFrontUrl} onPreview={setLightboxUrl} />
                  <DocTile label="ID – Back" url={selected.documentBackUrl} onPreview={setLightboxUrl} />
                  <DocTile label="Selfie with ID" url={selected.selfieUrl} onPreview={setLightboxUrl} />
                  {'proofOfAddressUrl' in selected && (selected as { proofOfAddressUrl?: string | null }).proofOfAddressUrl ? (
                    <DocTile label="Proof of Address" url={(selected as { proofOfAddressUrl?: string | null }).proofOfAddressUrl} onPreview={setLightboxUrl} />
                  ) : null}
                </div>
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

      {/* Lightbox */}
      {lightboxUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Document preview"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            aria-label="Close preview"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Document preview"
            className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

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
