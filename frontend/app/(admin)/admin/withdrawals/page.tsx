'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpFromLine, Search } from 'lucide-react'

import { PermissionDenied } from '@/components/auth/permission-denied'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { adminApi } from '@/services/api/admin'
import { useNotificationStore } from '@/store/notification-store'
import { AdminWithdrawalRecord } from '@/types/admin'

type WithdrawalTab = 'PENDING' | 'APPROVED' | 'ALL'

function shortenAddress(value: string) {
  if (value.length <= 18) {
    return value
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

function StatusPill({ status }: { status: AdminWithdrawalRecord['status'] }) {
  const classes: Record<AdminWithdrawalRecord['status'], string> = {
    PENDING: 'bg-[#3A2A0E] text-[#FCD34D]',
    APPROVED: 'bg-[#0E3127] text-[#A7F3D0]',
    SENT: 'bg-[#172554] text-[#BFDBFE]',
    COMPLETED: 'bg-[#0E3127] text-[#A7F3D0]',
    REJECTED: 'bg-[#3A1217] text-[#FCA5A5]',
    CANCELLED: 'bg-[#1F2937] text-[#D1D5DB]',
  }

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes[status]}`}>
      {status}
    </span>
  )
}

export default function AdminWithdrawalsPage() {
  const { hasPermission } = useAuth()
  const pushNotification = useNotificationStore((state) => state.push)
  const canView = hasPermission('transactions.view')
  const canApprove = hasPermission('withdrawals.approve')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<WithdrawalTab>('PENDING')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<AdminWithdrawalRecord[]>([])
  const [pendingReject, setPendingReject] = useState<AdminWithdrawalRecord | null>(null)
  const [pendingMarkSent, setPendingMarkSent] = useState<AdminWithdrawalRecord | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [txHash, setTxHash] = useState('')
  const [txNote, setTxNote] = useState('')

  async function refresh() {
    const response = await adminApi.listWithdrawals()
    setItems(response)
  }

  useEffect(() => {
    if (!canView) {
      return
    }

    let active = true

    void refresh()
      .catch((error) => {
        if (active) {
          pushNotification({
            title: 'Withdrawals unavailable',
            description: error instanceof Error ? error.message : 'Unable to load withdrawals.',
            type: 'error',
          })
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [canView, pushNotification])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    const base =
      tab === 'ALL'
        ? items
        : items.filter((entry) => entry.status === tab)

    if (!normalizedSearch) {
      return base
    }

    return base.filter((entry) =>
      [
        entry.user.email,
        entry.user.accountNumber,
        entry.account.accountNo,
        entry.toAddress,
        entry.txHash ?? '',
      ].some((value) => value.toLowerCase().includes(normalizedSearch)),
    )
  }, [items, search, tab])

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Finance"
          title="Withdrawals"
          description="Pending and processed client withdrawal requests."
        />
        <PermissionDenied
          title="Withdrawals unavailable"
          description="This admin account does not have permission to review withdrawal requests."
          requiredPermission="transactions.view"
        />
      </div>
    )
  }

  async function handleApprove(item: AdminWithdrawalRecord) {
    try {
      await adminApi.approveWithdrawal(item.id)
      pushNotification({
        title: 'Withdrawal approved',
        description: `${item.user.email} withdrawal moved to approved.`,
        type: 'success',
      })
      await refresh()
    } catch (error) {
      pushNotification({
        title: 'Approval failed',
        description: error instanceof Error ? error.message : 'Unable to approve withdrawal.',
        type: 'error',
      })
    }
  }

  async function handleReject() {
    if (!pendingReject) {
      return
    }

    try {
      await adminApi.rejectWithdrawal(pendingReject.id, rejectionReason || 'Rejected by admin')
      pushNotification({
        title: 'Withdrawal rejected',
        description: `${pendingReject.user.email} withdrawal was rejected.`,
        type: 'success',
      })
      setPendingReject(null)
      setRejectionReason('')
      await refresh()
    } catch (error) {
      pushNotification({
        title: 'Rejection failed',
        description: error instanceof Error ? error.message : 'Unable to reject withdrawal.',
        type: 'error',
      })
    }
  }

  async function handleMarkSent() {
    if (!pendingMarkSent) {
      return
    }

    try {
      await adminApi.markWithdrawalAsSent(pendingMarkSent.id, {
        txHash,
        adminNote: txNote || undefined,
      })
      pushNotification({
        title: 'Withdrawal marked as sent',
        description: `${pendingMarkSent.user.email} withdrawal now has a payout transaction hash.`,
        type: 'success',
      })
      setPendingMarkSent(null)
      setTxHash('')
      setTxNote('')
      await refresh()
    } catch (error) {
      pushNotification({
        title: 'Send confirmation failed',
        description: error instanceof Error ? error.message : 'Unable to mark withdrawal as sent.',
        type: 'error',
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Withdrawals"
        description="Review pending cash-out requests, debit balances on approval, and complete payouts after they are sent."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="label-eyebrow">Pending</p>
          <p className="mt-3 text-3xl font-semibold text-primary">
            {items.filter((entry) => entry.status === 'PENDING').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="label-eyebrow">Approved</p>
          <p className="mt-3 text-3xl font-semibold text-primary">
            {items.filter((entry) => entry.status === 'APPROVED').length}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="label-eyebrow">Pending Outflow</p>
          <p className="mt-3 text-3xl font-semibold text-primary">
            {formatCurrency(
              items
                .filter((entry) => entry.status === 'PENDING' || entry.status === 'APPROVED')
                .reduce((sum, entry) => sum + entry.netAmount, 0),
            )}
          </p>
        </div>
      </div>

      <Panel
        title="Withdrawal Queue"
        description="Pending requests do not debit balances until approval. Approved requests are awaiting treasury payout."
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {(['PENDING', 'APPROVED', 'ALL'] as WithdrawalTab[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={
                    tab === value
                      ? 'h-10 whitespace-nowrap rounded-md bg-accent px-4 text-sm font-semibold text-[#0D1320]'
                      : 'h-10 whitespace-nowrap rounded-md border border-border bg-page px-4 text-sm font-semibold text-primary transition hover:border-white/15 hover:bg-page/80'
                  }
                >
                  {value === 'ALL' ? 'All Withdrawals' : value}
                </button>
              ))}
            </div>
            <div className="relative min-w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search email, account, address, tx hash"
                className="pl-10"
              />
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full bg-page" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-page">
              <ArrowUpFromLine className="h-6 w-6 text-muted" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-primary">No withdrawals found</p>
              <p className="max-w-md text-sm leading-6 text-secondary">
                Matching withdrawal requests will appear here as clients submit them.
              </p>
            </div>
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="min-w-[1080px] border-separate border-spacing-0 text-left text-sm sm:min-w-full">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  <th className="border-b border-border pb-3 pr-4">Client</th>
                  <th className="border-b border-border pb-3 pr-4 text-right">Amount</th>
                  <th className="border-b border-border pb-3 pr-4 text-right">Fee</th>
                  <th className="border-b border-border pb-3 pr-4 text-right">Net</th>
                  <th className="border-b border-border pb-3 pr-4">Network</th>
                  <th className="border-b border-border pb-3 pr-4">Destination</th>
                  <th className="border-b border-border pb-3 pr-4">Requested</th>
                  <th className="border-b border-border pb-3 pr-4">Status</th>
                  <th className="border-b border-border pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-page/60">
                    <td className="border-b border-border py-4 pr-4">
                      <p className="font-medium text-primary">{item.user.email}</p>
                      <p className="mt-1 text-xs text-secondary">
                        {item.account.accountNo} • {item.account.name}
                      </p>
                    </td>
                    <td className="border-b border-border py-4 pr-4 text-right font-semibold text-primary">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="border-b border-border py-4 pr-4 text-right text-secondary">
                      {formatCurrency(item.fee)}
                    </td>
                    <td className="border-b border-border py-4 pr-4 text-right font-semibold text-primary">
                      {formatCurrency(item.netAmount)}
                    </td>
                    <td className="border-b border-border py-4 pr-4 text-primary">{item.network}</td>
                    <td className="border-b border-border py-4 pr-4 font-mono text-xs text-secondary" title={item.toAddress}>
                      {shortenAddress(item.toAddress)}
                    </td>
                    <td className="border-b border-border py-4 pr-4 text-secondary">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td className="border-b border-border py-4 pr-4">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="border-b border-border py-4">
                      {!canApprove ? (
                        <span className="text-sm text-secondary">No approval access</span>
                      ) : item.status === 'PENDING' ? (
                        <div className="flex gap-2">
                          <Button variant="success" className="h-9 px-3" onClick={() => void handleApprove(item)}>
                            Approve
                          </Button>
                          <Button variant="danger" className="h-9 px-3" onClick={() => setPendingReject(item)}>
                            Reject
                          </Button>
                        </div>
                      ) : item.status === 'APPROVED' ? (
                        <Button
                          variant="secondary"
                          className="h-9 px-3"
                          onClick={() => setPendingMarkSent(item)}
                        >
                          Mark as Sent
                        </Button>
                      ) : (
                        <span className="text-sm text-secondary">
                          {item.txHash ? 'TxHash recorded' : 'Processed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={pendingReject !== null}
        title="Reject withdrawal"
        description={
          pendingReject
            ? pendingReject.status === 'APPROVED'
              ? `Reject ${formatCurrency(pendingReject.amount)} withdrawal for ${pendingReject.user.email}. The approved debit will be returned to the client account.`
              : `Reject ${formatCurrency(pendingReject.amount)} withdrawal for ${pendingReject.user.email}. No balance debit will be applied.`
            : ''
        }
        confirmLabel="Reject withdrawal"
        tone="danger"
        onCancel={() => {
          setPendingReject(null)
          setRejectionReason('')
        }}
        onConfirm={() => void handleReject()}
      >
        <Input
          label="Rejection reason"
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          placeholder="Reason shown in admin notes"
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={pendingMarkSent !== null}
        title="Mark withdrawal as sent"
        description={
          pendingMarkSent
            ? `Enter the on-chain transaction hash after sending ${formatCurrency(pendingMarkSent.netAmount)} to ${pendingMarkSent.user.email}.`
            : ''
        }
        confirmLabel="Confirm sent"
        onCancel={() => {
          setPendingMarkSent(null)
          setTxHash('')
          setTxNote('')
        }}
        onConfirm={() => void handleMarkSent()}
      >
        <div className="space-y-4">
          <Input
            label="Transaction hash"
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            placeholder="Paste blockchain transaction hash"
            className="font-mono"
          />
          <Input
            label="Admin note"
            value={txNote}
            onChange={(event) => setTxNote(event.target.value)}
            placeholder="Optional internal note"
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}
