'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { env } from '@/lib/env';
import { adminRoute } from '@/lib/admin-route';
import { formatDateTime, formatNumber, formatUsdt } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { crmApi } from '@/services/api/crm';
import { kycApi } from '@/services/api/kyc';
import { useNotificationStore } from '@/store/notification-store';
import { CrmClientNote, CrmClientProfile } from '@/types/crm';
import { WalletTransaction } from '@/types/wallet';

type ProfileTab =
  | 'overview'
  | 'compliance'
  | 'accounts'
  | 'trading'
  | 'transactions'
  | 'emails'
  | 'notes';

const profileTabs: Array<{ value: ProfileTab; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'compliance', label: 'Compliance / KYC' },
  { value: 'accounts', label: 'Accounts & Balances' },
  { value: 'trading', label: 'Trading History' },
  { value: 'transactions', label: 'Transactions' },
  { value: 'emails', label: 'Email History' },
  { value: 'notes', label: 'Notes' },
];

const noteTypes = ['GENERAL', 'COMPLIANCE', 'SUPPORT', 'RISK', 'FINANCIAL'] as const;

function resolveAssetUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${env.apiUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

function inferMimeType(url: string | null | undefined) {
  const lower = url?.toLowerCase() ?? '';

  if (lower.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.gif')
  ) {
    return 'image/*';
  }

  return 'application/octet-stream';
}

function getInitials(value: string | null | undefined) {
  if (!value?.trim()) {
    return 'NA';
  }

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function formatRelativeTime(value: string) {
  const target = new Date(value).getTime();
  const diffMs = target - Date.now();

  if (!Number.isFinite(target)) {
    return '--';
  }

  const thresholds = [
    { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
    { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'minute', ms: 60 * 1000 },
  ] as const;

  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  for (const threshold of thresholds) {
    if (Math.abs(diffMs) >= threshold.ms) {
      return formatter.format(Math.round(diffMs / threshold.ms), threshold.unit);
    }
  }

  return formatter.format(Math.round(diffMs / 1000), 'second');
}

function getTransactionMethod(transaction: WalletTransaction) {
  if (
    transaction.metadata &&
    typeof transaction.metadata === 'object' &&
    'network' in transaction.metadata
  ) {
    const network = transaction.metadata.network;

    if (typeof network === 'string' && network.trim()) {
      return network;
    }
  }

  return transaction.asset;
}

function getTransactionReference(transaction: WalletTransaction) {
  if (transaction.reference?.trim()) {
    return transaction.reference;
  }

  if (
    transaction.metadata &&
    typeof transaction.metadata === 'object' &&
    'txHash' in transaction.metadata
  ) {
    const txHash = transaction.metadata.txHash;

    if (typeof txHash === 'string' && txHash.trim()) {
      return txHash;
    }
  }

  return '--';
}

export default function CrmClientProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, user: authUser } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [profile, setProfile] = useState<CrmClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [noteType, setNoteType] = useState<(typeof noteTypes)[number]>('GENERAL');
  const [noteContent, setNoteContent] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteType, setEditingNoteType] = useState<(typeof noteTypes)[number]>('GENERAL');
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [kycActionLoading, setKycActionLoading] = useState<'approve' | 'reject' | null>(null);
  const [accountMutation, setAccountMutation] = useState<'activate' | 'suspend' | null>(null);
  const [transactionMutationId, setTransactionMutationId] = useState<string | null>(null);
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  const rawAccountNo = params?.accountNo;
  const accountNo = Array.isArray(rawAccountNo) ? rawAccountNo[0] : rawAccountNo;
  const canReadCrm = hasPermission('crm.read');
  const canAddNotes = hasPermission('crm.notes');
  const canSendEmail = hasPermission('email.send');
  const canManageUsers = hasPermission('users.manage');
  const canCreditUser = hasPermission('users.credit');
  const canApproveKyc = hasPermission('kyc.approve');
  const canApproveDeposits = hasPermission('deposits.approve');
  const canApproveWithdrawals = hasPermission('withdrawals.approve');
  const isSuperAdmin = authUser?.adminRole === 'SUPER_ADMIN';
  const closedPositions = useMemo(
    () =>
      (profile?.positions ?? [])
        .filter((position) => position.status === 'CLOSED')
        .sort(
          (left, right) =>
            new Date(right.closedAt ?? right.updatedAt).getTime() -
            new Date(left.closedAt ?? left.updatedAt).getTime(),
        ),
    [profile?.positions],
  );
  const paginatedClosedPositions = useMemo(
    () => closedPositions.slice((historyPage - 1) * 10, historyPage * 10),
    [closedPositions, historyPage],
  );
  const historyPageCount = Math.max(1, Math.ceil(closedPositions.length / 10));
  const complianceDocuments = useMemo(() => {
    if (!profile?.kycSubmission) {
      return [];
    }

    const submission = profile.kycSubmission;
    const primaryDocuments = [
      {
        id: 'document-front',
        label: 'ID document front',
        kind: 'DOCUMENT_FRONT',
        fileUrl: submission.documentFrontUrl ?? null,
        mimeType: inferMimeType(submission.documentFrontUrl),
        originalName: 'identity-front',
      },
      {
        id: 'document-back',
        label: 'ID document back',
        kind: 'DOCUMENT_BACK',
        fileUrl: submission.documentBackUrl ?? null,
        mimeType: inferMimeType(submission.documentBackUrl),
        originalName: 'identity-back',
      },
      {
        id: 'proof-of-address',
        label: 'Proof of address',
        kind: 'PROOF_OF_ADDRESS',
        fileUrl: submission.proofOfAddressUrl ?? null,
        mimeType: inferMimeType(submission.proofOfAddressUrl),
        originalName: 'proof-of-address',
      },
      {
        id: 'selfie',
        label: 'Selfie',
        kind: 'SELFIE',
        fileUrl: submission.selfieUrl ?? null,
        mimeType: inferMimeType(submission.selfieUrl),
        originalName: 'selfie',
      },
    ].filter((document) => Boolean(document.fileUrl));

    return [...primaryDocuments, ...(submission.documents ?? [])];
  }, [profile?.kycSubmission]);

  async function loadProfile() {
    if (!accountNo || !canReadCrm) {
      return;
    }

    const response = await crmApi.getClientProfile(accountNo);
    setProfile(response);
  }

  useEffect(() => {
    if (!canReadCrm) {
      setLoading(false);
      return;
    }

    let active = true;

    if (!accountNo) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void crmApi
      .getClientProfile(accountNo)
      .then((response) => {
        if (active) {
          setProfile(response);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load client profile',
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
  }, [accountNo, canReadCrm, pushNotification]);

  async function handleAccountMutation(action: 'activate' | 'suspend') {
    if (!profile || !canManageUsers) {
      return;
    }

    setAccountMutation(action);

    try {
      await (action === 'activate'
        ? adminApi.activateUser(profile.id)
        : adminApi.suspendUser(profile.id));
      await loadProfile();
      pushNotification({
        title: action === 'activate' ? 'Client activated' : 'Client suspended',
        description: `${profile.accountNumber} account state updated.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: action === 'activate' ? 'Activation failed' : 'Suspension failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setAccountMutation(null);
    }
  }

  async function handleApproveKyc() {
    if (!profile?.kycSubmission?.id || !canApproveKyc) {
      return;
    }

    setKycActionLoading('approve');

    try {
      await kycApi.approve(profile.kycSubmission.id);
      await loadProfile();
      pushNotification({
        title: 'KYC approved',
        description: `${profile.accountNumber} has been approved and notified by email.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'KYC approval failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setKycActionLoading(null);
    }
  }

  async function handleRejectKyc() {
    if (!profile?.kycSubmission?.id || !canApproveKyc) {
      return;
    }

    const reason = window.prompt('Enter the rejection reason for this KYC submission.');

    if (!reason?.trim()) {
      return;
    }

    setKycActionLoading('reject');

    try {
      await kycApi.reject(profile.kycSubmission.id, reason.trim());
      await loadProfile();
      pushNotification({
        title: 'KYC rejected',
        description: `${profile.accountNumber} has been rejected and notified by email.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'KYC rejection failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setKycActionLoading(null);
    }
  }

  async function handleGiveCredit() {
    if (!profile || !canCreditUser) {
      return;
    }

    const parsed = Number.parseFloat(creditAmount)

    if (!Number.isFinite(parsed) || parsed <= 0) {
      pushNotification({ title: 'Invalid amount', description: 'Enter a valid positive amount.', type: 'error' })
      return
    }

    setCreditSubmitting(true)

    try {
      await adminApi.creditUser(profile.id, {
        amount: parsed,
        reason: creditReason.trim() || undefined,
      })
      await loadProfile()
      setCreditModalOpen(false)
      setCreditAmount('')
      setCreditReason('')
      pushNotification({
        title: 'Credit applied',
        description: `$${parsed.toFixed(2)} USDT credited to ${profile.accountNumber}.`,
        type: 'success',
      })
    } catch (error) {
      pushNotification({
        title: 'Credit failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      })
    } finally {
      setCreditSubmitting(false)
    }
  }

  async function handleAddNote() {
    if (!profile || !canAddNotes || noteContent.trim().length < 3) {
      return;
    }

    setSubmittingNote(true);

    try {
      const note = await crmApi.addNote(profile.id, {
        noteType,
        content: noteContent.trim(),
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              notes: [note, ...current.notes],
            }
          : current,
      );
      setNoteContent('');
      setNoteType('GENERAL');
      pushNotification({
        title: 'Note added',
        description: `Internal note saved for ${profile.accountNumber}.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to add note',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSubmittingNote(false);
    }
  }

  async function handleUpdateNote(noteId: string) {
    if (!profile || !canAddNotes || editingNoteContent.trim().length < 3) {
      return;
    }

    try {
      const updated = await crmApi.updateNote(profile.id, noteId, {
        noteType: editingNoteType,
        content: editingNoteContent.trim(),
      });
      setProfile((current) =>
        current
          ? {
              ...current,
              notes: current.notes.map((note) => (note.id === noteId ? updated : note)),
            }
          : current,
      );
      setEditingNoteId(null);
      setEditingNoteContent('');
      pushNotification({
        title: 'Note updated',
        description: 'The internal note has been updated.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to update note',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  async function handleDeleteNote(note: CrmClientNote) {
    if (!profile || !canAddNotes) {
      return;
    }

    if (!window.confirm('Delete this internal note?')) {
      return;
    }

    try {
      await crmApi.deleteNote(profile.id, note.id);
      setProfile((current) =>
        current
          ? {
              ...current,
              notes: current.notes.filter((entry) => entry.id !== note.id),
            }
          : current,
      );
      pushNotification({
        title: 'Note deleted',
        description: 'The internal note has been removed.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to delete note',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  async function handleApproveTransaction(transaction: WalletTransaction) {
    if (!profile || !canApproveTransaction(transaction)) {
      return;
    }

    setTransactionMutationId(transaction.id);

    try {
      await adminApi.approveTransaction(transaction.id);
      await loadProfile();
      pushNotification({
        title: 'Transaction confirmed',
        description: `${transaction.type} request approved for ${profile.accountNumber}.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Transaction approval failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setTransactionMutationId(null);
    }
  }

  function beginEditNote(note: CrmClientNote) {
    setEditingNoteId(note.id);
    setEditingNoteType(note.noteType);
    setEditingNoteContent(note.content);
  }

  function canEditNote(note: CrmClientNote) {
    return canAddNotes && (note.authorId === authUser?.id || isSuperAdmin);
  }

  function canApproveTransaction(transaction: WalletTransaction) {
    if (transaction.type === 'DEPOSIT') {
      return canApproveDeposits;
    }

    if (transaction.type === 'WITHDRAW') {
      return canApproveWithdrawals;
    }

    return false;
  }

  if (!canReadCrm) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM / Client"
          title="CRM / Client"
          description="Full client record spanning compliance, balances, trading history, funding activity, email correspondence, and internal notes."
          actions={
            <Button asChild variant="secondary">
              <Link href={adminRoute('/crm')}>Back to CRM</Link>
            </Button>
          }
        />
        <PermissionDenied
          title="CRM unavailable"
          description="This admin account does not have permission to access client CRM records."
          requiredPermission="crm.read"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM / Client"
          title="Client profile"
          description="Loading client profile, compliance documents, notes, balances, and trading history."
        />
        <Panel>
          <p className="text-sm text-secondary">Loading client profile...</p>
        </Panel>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM / Client"
          title="Client not found"
          description="This account number could not be resolved."
          actions={
            <Button asChild variant="secondary">
              <Link href={adminRoute('/crm')}>Back to CRM</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM / Client"
        title={`${profile.fullName ?? profile.email} (${profile.accountNumber})`}
        description="Full client record spanning compliance, balances, trading history, funding activity, email correspondence, and internal notes."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={adminRoute('/crm')}>Back to CRM</Link>
            </Button>
            {canSendEmail ? (
              <Button
                variant="secondary"
                onClick={() =>
                  router.push(
                    `${adminRoute('/crm/email')}?userIds=${encodeURIComponent(profile.id)}`,
                  )
                }
              >
                Send Email
              </Button>
            ) : null}
            {canAddNotes ? (
              <Button variant="secondary" onClick={() => setActiveTab('notes')}>
                Add Note
              </Button>
            ) : null}
            {canCreditUser ? (
              <Button variant="secondary" onClick={() => setCreditModalOpen(true)}>
                Give Credit
              </Button>
            ) : null}
            {canManageUsers ? (
              <>
                <Button
                  variant="secondary"
                  disabled={accountMutation !== null}
                  onClick={() => void handleAccountMutation('activate')}
                >
                  {accountMutation === 'activate' ? 'Activating...' : 'Activate'}
                </Button>
                <Button
                  variant="danger"
                  disabled={accountMutation !== null}
                  onClick={() => void handleAccountMutation('suspend')}
                >
                  {accountMutation === 'suspend' ? 'Suspending...' : 'Suspend'}
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Panel
          title="Client Record"
          description="Navigate between overview, compliance, balances, trading, funding, email, and notes."
          contentClassName="p-3"
        >
          <div className="space-y-2">
            {profileTabs.map((tab) => {
              const active = activeTab === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                    active
                      ? 'bg-[#0F172A] text-white'
                      : 'bg-page text-primary hover:border-accent hover:bg-surface'
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-6">
          {activeTab === 'overview' ? (
            <>
              <Panel title="Overview" description="Primary client identity, status, and quick actions.">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <div className="rounded-3xl border border-border bg-page p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0F172A] text-lg font-semibold text-white">
                        {getInitials(profile.fullName ?? profile.email)}
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-primary">
                          {profile.fullName ?? 'Client profile'}
                        </p>
                        <p className="mt-1 text-sm text-secondary">{profile.email}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge value={profile.accountNumber} />
                          <StatusBadge value={profile.accountStatus} />
                          <StatusBadge value={profile.kycSubmission?.status ?? 'NOT_SUBMITTED'} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {[
                        ['Phone', profile.phone ?? '--'],
                        ['Country', profile.country ?? '--'],
                        ['City', profile.city ?? '--'],
                        ['Registered', formatDateTime(profile.createdAt)],
                        [
                          'Last login',
                          profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : '--',
                        ],
                        ['Account status', profile.accountStatus],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                          <p className="label-eyebrow">{label}</p>
                          <p className="mt-2 text-sm text-primary">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-3xl border border-border bg-page p-5">
                      <p className="label-eyebrow">Total Balance</p>
                      <p className="mt-3 text-2xl font-semibold text-primary">
                        {formatUsdt(profile.stats.totalBalance)}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border bg-page p-5">
                      <p className="label-eyebrow">Total Trades</p>
                      <p className="mt-3 text-2xl font-semibold text-primary">
                        {formatNumber(profile.stats.totalTrades, 0)}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border bg-page p-5">
                      <p className="label-eyebrow">Total Deposits</p>
                      <p className="mt-3 text-2xl font-semibold text-primary">
                        {formatUsdt(profile.stats.totalDeposits)}
                      </p>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title="Recent activity" description="Latest transactions, notes, and closed trades for this client.">
                <div className="grid gap-5 lg:grid-cols-3">
                  <div className="space-y-3">
                    <p className="label-eyebrow">Latest transactions</p>
                    {profile.transactions.slice(0, 3).map((transaction) => (
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
                  <div className="space-y-3">
                    <p className="label-eyebrow">Latest notes</p>
                    {profile.notes.slice(0, 3).map((note) => (
                      <div key={note.id} className="rounded-2xl border border-border bg-page p-4">
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge value={note.noteType} />
                          <p className="text-xs text-secondary">
                            {formatRelativeTime(note.createdAt)}
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-primary">{note.content}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <p className="label-eyebrow">Latest closed trades</p>
                    {closedPositions.slice(0, 3).map((position) => (
                      <div key={position.id} className="rounded-2xl border border-border bg-page p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-primary">
                            {position.symbol} {position.side}
                          </p>
                          <p
                            className={`text-sm font-medium ${
                              position.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {formatUsdt(position.pnl)}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-secondary">
                          {formatNumber(position.volume, 4)} lots • Closed{' '}
                          {formatDateTime(position.closedAt ?? position.updatedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </>
          ) : null}

          {activeTab === 'compliance' ? (
            <Panel
              title="Compliance / KYC"
              description="Submitted identity data, document viewer, decision controls, and review history."
              actions={
                profile.kycSubmission && canApproveKyc ? (
                  <>
                    <Button
                      variant="success"
                      disabled={kycActionLoading !== null}
                      onClick={() => void handleApproveKyc()}
                    >
                      {kycActionLoading === 'approve' ? 'Approving...' : 'Approve KYC'}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={kycActionLoading !== null}
                      onClick={() => void handleRejectKyc()}
                    >
                      {kycActionLoading === 'reject' ? 'Rejecting...' : 'Reject KYC'}
                    </Button>
                  </>
                ) : undefined
              }
            >
              {profile.kycSubmission ? (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-page p-5">
                    <div>
                      <p className="text-lg font-semibold text-primary">
                        {profile.kycSubmission.fullName}
                      </p>
                      <p className="mt-1 text-sm text-secondary">
                        Submitted {formatDateTime(profile.kycSubmission.createdAt)}
                      </p>
                    </div>
                    <StatusBadge value={profile.kycSubmission.status} />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {[
                      ['Date of birth', profile.kycSubmission.dateOfBirth],
                      ['Nationality', profile.kycSubmission.country],
                      ['Address', profile.kycSubmission.addressLine1],
                      ['City', profile.kycSubmission.city],
                      ['Postal code', profile.kycSubmission.postalCode],
                      ['Document type', profile.kycSubmission.documentType],
                      ['Document number', profile.kycSubmission.documentNumber],
                      [
                        'Reviewed at',
                        profile.kycSubmission.reviewedAt
                          ? formatDateTime(profile.kycSubmission.reviewedAt)
                          : 'Waiting for review',
                      ],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border bg-page p-4">
                        <p className="label-eyebrow">{label}</p>
                        <p className="mt-2 break-words text-sm text-primary">{value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <p className="label-eyebrow">Document Viewer</p>
                    {complianceDocuments.length === 0 ? (
                      <div className="rounded-2xl border border-border bg-page p-4 text-sm text-secondary">
                        No KYC documents have been uploaded yet.
                      </div>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-2">
                        {complianceDocuments.map((document) => {
                          const assetUrl = resolveAssetUrl(document.fileUrl);
                          const isImage = document.mimeType.startsWith('image/');
                          const isPdf = document.mimeType === 'application/pdf';

                          return (
                            <div key={document.id} className="rounded-3xl border border-border bg-page p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium text-primary">
                                    {document.label ?? document.kind}
                                  </p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-secondary">
                                    {document.kind}
                                  </p>
                                </div>
                                {assetUrl ? (
                                  <a
                                    href={assetUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm font-medium text-accent hover:underline"
                                  >
                                    Download
                                  </a>
                                ) : null}
                              </div>

                              {assetUrl ? (
                                <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
                                  {isImage ? (
                                    <img
                                      src={assetUrl}
                                      alt={document.label ?? document.kind}
                                      className="h-56 w-full object-contain sm:h-72"
                                    />
                                  ) : isPdf ? (
                                    <iframe
                                      src={assetUrl}
                                      title={document.label ?? document.kind}
                                      className="h-56 w-full sm:h-72"
                                    />
                                  ) : (
                                    <div className="flex h-56 items-center justify-center px-6 text-center text-sm text-secondary sm:h-72">
                                      Preview unavailable for this file type. Use Download to inspect the file.
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <p className="label-eyebrow">KYC history</p>
                    <div className="space-y-3">
                      {profile.kycSubmission.decisionLogs.length === 0 ? (
                        <div className="rounded-2xl border border-border bg-page p-4 text-sm text-secondary">
                          No KYC decisions logged yet.
                        </div>
                      ) : (
                        profile.kycSubmission.decisionLogs.map((entry) => (
                          <div key={entry.id} className="rounded-2xl border border-border bg-page p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {entry.fromStatus ? <StatusBadge value={entry.fromStatus} /> : null}
                                <span className="text-sm text-secondary">to</span>
                                <StatusBadge value={entry.toStatus} />
                              </div>
                              <p className="text-sm text-secondary">
                                {formatDateTime(entry.createdAt)}
                              </p>
                            </div>
                            <p className="mt-3 text-sm text-primary">
                              Reviewer: {entry.reviewer?.displayName ?? entry.reviewer?.email ?? 'System'}
                            </p>
                            {entry.note ? (
                              <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">
                                {entry.note}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-secondary">This client has not submitted KYC yet.</p>
              )}
            </Panel>
          ) : null}

          {activeTab === 'accounts' ? (
            <Panel title="Accounts & Balances" description="All active live and demo accounts with current balances and open position counts.">
              <div className="grid gap-4 xl:grid-cols-2">
                {profile.accounts.map((account) => (
                  <div key={account.id} className="rounded-3xl border border-border bg-page p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-primary">
                          {account.name} ({account.accountNo})
                        </p>
                        <p className="mt-1 text-sm text-secondary">
                          Created {formatDateTime(account.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={account.type} />
                        <StatusBadge value={account.status} />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <p className="label-eyebrow">Balance</p>
                        <p className="mt-2 text-xl font-semibold text-primary">
                          {formatUsdt(account.balance)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <p className="label-eyebrow">Equity</p>
                        <p className="mt-2 text-xl font-semibold text-primary">
                          {formatUsdt(account.equity)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <p className="label-eyebrow">Open positions</p>
                        <p className="mt-2 text-xl font-semibold text-primary">
                          {formatNumber(account.openPositions, 0)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border bg-surface p-4">
                        <p className="label-eyebrow">Type</p>
                        <p className="mt-2 text-xl font-semibold text-primary">{account.type}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}

          {activeTab === 'trading' ? (
            <Panel title="Trading History" description="Closed positions ordered by close time, with client-side pagination.">
              <div className="-mx-4 overflow-x-auto sm:mx-0">
                <table className="min-w-[820px] divide-y divide-border text-sm">
                  <thead className="bg-page">
                    <tr className="text-left text-xs uppercase tracking-[0.14em] text-secondary">
                      {[
                        'Symbol',
                        'Side',
                        'Volume',
                        'Open Price',
                        'Close Price',
                        'P&L',
                        'Open Time',
                        'Close Time',
                      ].map((label) => (
                        <th key={label} className="px-4 py-3 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginatedClosedPositions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-secondary">
                          No closed trades recorded for this client.
                        </td>
                      </tr>
                    ) : (
                      paginatedClosedPositions.map((position) => (
                        <tr key={position.id}>
                          <td className="px-4 py-3">{position.symbol}</td>
                          <td className="px-4 py-3">
                            <StatusBadge value={position.side} />
                          </td>
                          <td className="px-4 py-3">{formatNumber(position.volume, 4)}</td>
                          <td className="px-4 py-3">{formatNumber(position.entryPrice, 5)}</td>
                          <td className="px-4 py-3">
                            {position.exitPrice !== null ? formatNumber(position.exitPrice, 5) : '--'}
                          </td>
                          <td
                            className={`px-4 py-3 font-medium ${
                              position.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }`}
                          >
                            {formatUsdt(position.pnl)}
                          </td>
                          <td className="px-4 py-3">{formatDateTime(position.openedAt)}</td>
                          <td className="px-4 py-3">
                            {position.closedAt ? formatDateTime(position.closedAt) : '--'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-secondary">
                  Page {historyPage} of {historyPageCount}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="secondary"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={historyPage >= historyPageCount}
                    onClick={() =>
                      setHistoryPage((current) => Math.min(historyPageCount, current + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Panel>
          ) : null}

          {activeTab === 'transactions' ? (
            <Panel title="Transactions" description="Deposits and withdrawals with manual confirmation for pending items.">
              <div className="space-y-4">
                {profile.transactions.length === 0 ? (
                  <p className="text-sm text-secondary">No deposit or withdrawal history yet.</p>
                ) : (
                  profile.transactions.map((transaction) => (
                    <div key={transaction.id} className="rounded-3xl border border-border bg-page p-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_auto] lg:items-center">
                        <div>
                          <p className="font-medium text-primary">{transaction.type}</p>
                          <p className="mt-1 text-sm text-secondary">
                            {formatDateTime(transaction.createdAt)}
                          </p>
                        </div>
                        <div>
                          <p className="label-eyebrow">Amount</p>
                          <p className="mt-2 text-sm text-primary">{formatUsdt(transaction.amount)}</p>
                        </div>
                        <div>
                          <p className="label-eyebrow">Method</p>
                          <p className="mt-2 text-sm text-primary">{getTransactionMethod(transaction)}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="label-eyebrow">TxHash / Reference</p>
                          <p className="mt-2 truncate text-sm text-primary">
                            {getTransactionReference(transaction)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge value={transaction.status} />
                          {transaction.status === 'PENDING' && canApproveTransaction(transaction) ? (
                            <Button
                              variant="secondary"
                              disabled={transactionMutationId === transaction.id}
                              onClick={() => void handleApproveTransaction(transaction)}
                            >
                              {transactionMutationId === transaction.id ? 'Confirming...' : 'Confirm'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Panel>
          ) : null}

          {activeTab === 'emails' ? (
            <Panel title="Email History" description="Every CRM email logged against this client, with full body expansion.">
              <div className="space-y-3">
                {profile.emailLogs.length === 0 ? (
                  <p className="text-sm text-secondary">No CRM email history is available for this client.</p>
                ) : (
                  profile.emailLogs.map((log) => (
                    <div key={log.id} className="rounded-3xl border border-border bg-page p-4">
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                        onClick={() =>
                          setExpandedEmailId((current) => (current === log.id ? null : log.id))
                        }
                      >
                        <div>
                          <p className="font-medium text-primary">{log.subject}</p>
                          <p className="mt-1 text-sm text-secondary">
                            From {log.fromEmail} • {formatDateTime(log.sentAt)}
                          </p>
                        </div>
                        <StatusBadge value={log.status} />
                      </button>
                      {expandedEmailId === log.id ? (
                        <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
                          <div
                            className="prose prose-sm max-w-none text-primary"
                            dangerouslySetInnerHTML={{ __html: log.body }}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </Panel>
          ) : null}

          {activeTab === 'notes' ? (
            <Panel title="Notes" description="Internal-only notes visible to operations, compliance, support, and risk staff.">
              <div className="space-y-6">
                {canAddNotes ? (
                  <div className="rounded-3xl border border-border bg-page p-5">
                    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <Select
                        label="Note type"
                        value={noteType}
                        onChange={(event) =>
                          setNoteType(event.target.value as (typeof noteTypes)[number])
                        }
                      >
                        {noteTypes.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </Select>
                      <Textarea
                        label="Add internal note"
                        rows={4}
                        value={noteContent}
                        onChange={(event) => setNoteContent(event.target.value)}
                        placeholder="Record compliance, support, financial, or risk context for this client."
                      />
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        disabled={submittingNote || noteContent.trim().length < 3}
                        onClick={() => void handleAddNote()}
                      >
                        {submittingNote ? 'Adding...' : 'Add Note'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                    Missing permission: <span className="font-mono">crm.notes</span>
                  </div>
                )}

                <div className="space-y-4">
                  {profile.notes.length === 0 ? (
                    <p className="text-sm text-secondary">No internal notes have been recorded yet.</p>
                  ) : (
                    profile.notes.map((note) => {
                      const editable = canEditNote(note);
                      const editing = editingNoteId === note.id;

                      return (
                        <div key={note.id} className="rounded-3xl border border-border bg-page p-5">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex min-w-0 items-start gap-4">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0F172A] text-sm font-semibold text-white">
                                {getInitials(note.author?.displayName ?? note.author?.email)}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-primary">
                                    {note.author?.displayName ?? note.author?.email ?? 'Admin'}
                                  </p>
                                  <StatusBadge value={note.noteType} />
                                </div>
                                <p className="mt-1 text-sm text-secondary">
                                  {formatRelativeTime(note.createdAt)} • {formatDateTime(note.createdAt)}
                                </p>
                              </div>
                            </div>

                            {editable ? (
                              <div className="flex flex-wrap gap-2">
                                {!editing ? (
                                  <Button variant="secondary" onClick={() => beginEditNote(note)}>
                                    Edit
                                  </Button>
                                ) : null}
                                <Button variant="danger" onClick={() => void handleDeleteNote(note)}>
                                  Delete
                                </Button>
                              </div>
                            ) : null}
                          </div>

                          {editing ? (
                            <div className="mt-4 space-y-4">
                              <Select
                                label="Note type"
                                value={editingNoteType}
                                onChange={(event) =>
                                  setEditingNoteType(
                                    event.target.value as (typeof noteTypes)[number],
                                  )
                                }
                              >
                                {noteTypes.map((value) => (
                                  <option key={value} value={value}>
                                    {value}
                                  </option>
                                ))}
                              </Select>
                              <Textarea
                                label="Edit note"
                                rows={4}
                                value={editingNoteContent}
                                onChange={(event) => setEditingNoteContent(event.target.value)}
                              />
                              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteContent('');
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button onClick={() => void handleUpdateNote(note.id)}>Save</Button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-primary">
                              {note.content}
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {creditModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#1F2937] bg-[#111827] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Give Credit</h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Credit USDT directly to {profile?.accountNumber}. Funds are applied immediately.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">Amount (USDT)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#1F2937] bg-[#0A0E1A] px-4 text-sm text-[#F9FAFB] placeholder-[#4B5563] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#9CA3AF]">Reason (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Welcome bonus, compensation..."
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#1F2937] bg-[#0A0E1A] px-4 text-sm text-[#F9FAFB] placeholder-[#4B5563] focus:border-[#3B82F6] focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={creditSubmitting}
                onClick={() => {
                  setCreditModalOpen(false)
                  setCreditAmount('')
                  setCreditReason('')
                }}
              >
                Cancel
              </Button>
              <Button disabled={creditSubmitting} onClick={() => void handleGiveCredit()}>
                {creditSubmitting ? 'Applying...' : 'Apply Credit'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
