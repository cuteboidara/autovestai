'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { walletApi } from '@/services/api/wallet'
import { useNotificationStore } from '@/store/notification-store'
import { WithdrawalRequestRecord, WalletNetwork, WalletSummary } from '@/types/wallet'

const cardClass =
  'rounded-md border border-[#1F2937] bg-[#111827] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.28)]'

const networks: WalletNetwork[] = ['TRC20', 'ERC20']
const withdrawalFee = 2

function formatAmount(value: number | null | undefined, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value ?? NaN) ? value ?? 0 : 0)
}

function formatDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '--'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function shortenAddress(value: string) {
  if (value.length <= 18) {
    return value
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

function WithdrawalStatusPill({ status }: { status: WithdrawalRequestRecord['status'] }) {
  const statusMap: Record<
    WithdrawalRequestRecord['status'],
    { label: string; dot: string; text: string; bg: string }
  > = {
    PENDING: {
      label: 'Pending',
      dot: 'bg-[#F5A623]',
      text: 'text-[#FCD34D]',
      bg: 'bg-[#3A2A0E]',
    },
    APPROVED: {
      label: 'Approved',
      dot: 'bg-[#10B981]',
      text: 'text-[#A7F3D0]',
      bg: 'bg-[#0E3127]',
    },
    SENT: {
      label: 'Sent',
      dot: 'bg-[#60A5FA]',
      text: 'text-[#BFDBFE]',
      bg: 'bg-[#172554]',
    },
    COMPLETED: {
      label: 'Completed',
      dot: 'bg-[#10B981]',
      text: 'text-[#A7F3D0]',
      bg: 'bg-[#0E3127]',
    },
    REJECTED: {
      label: 'Rejected',
      dot: 'bg-[#EF4444]',
      text: 'text-[#FCA5A5]',
      bg: 'bg-[#3A1217]',
    },
    CANCELLED: {
      label: 'Cancelled',
      dot: 'bg-[#6B7280]',
      text: 'text-[#D1D5DB]',
      bg: 'bg-[#1F2937]',
    },
  }

  const meta = statusMap[status]

  return (
    <span className={`inline-flex items-center gap-2 rounded-full ${meta.bg} px-2.5 py-1 text-xs font-medium ${meta.text}`}>
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

export default function WithdrawPage() {
  const pushNotification = useNotificationStore((state) => state.push)
  const [wallet, setWallet] = useState<WalletSummary | null>(null)
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [form, setForm] = useState({
    network: 'TRC20' as WalletNetwork,
    amount: '',
    address: '',
  })

  async function refresh() {
    const [snapshot, history] = await Promise.all([
      walletApi.getWallet(),
      walletApi.listWithdrawals(),
    ])

    setWallet(snapshot.wallet)
    setWithdrawals(history)
  }

  useEffect(() => {
    let active = true

    void refresh()
      .catch((error) => {
        if (active) {
          pushNotification({
            title: 'Withdrawal desk unavailable',
            description: error instanceof Error ? error.message : 'Unable to load withdrawal data.',
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
  }, [pushNotification])

  const amount = Number.parseFloat(form.amount) || 0
  const availableBalance = wallet?.freeMargin ?? wallet?.balance ?? 0
  const receiveAmount = Math.max(amount - withdrawalFee, 0)

  async function submitWithdrawal() {
    setSubmitting(true)

    try {
      await walletApi.requestWithdrawal({
        amount,
        address: form.address.trim(),
        network: form.network,
        asset: 'USDT',
      })
      pushNotification({
        title: 'Withdrawal request submitted',
        description: 'Your request is now waiting for admin approval.',
        type: 'success',
      })
      setForm({
        network: 'TRC20',
        amount: '',
        address: '',
      })
      setConfirmOpen(false)
      await refresh()
    } catch (error) {
      pushNotification({
        title: 'Withdrawal request failed',
        description: error instanceof Error ? error.message : 'Unable to submit withdrawal.',
        type: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  function openConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setConfirmOpen(true)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Client Portal / Withdraw
        </p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#F9FAFB]">
          Withdraw USDT
        </h1>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={cardClass}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
            Available Balance
          </p>
          {loading ? (
            <Skeleton className="mt-6 h-10 w-40 bg-[#1A2234]" />
          ) : (
            <>
              <p className="mt-6 text-[30px] font-semibold text-[#10B981]">
                {formatAmount(availableBalance)}
              </p>
              <p className="mt-2 text-sm text-[#9CA3AF]">USDT</p>
            </>
          )}
        </div>
        <div className={cardClass}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
            Withdrawal Fee
          </p>
          <p className="mt-6 text-[30px] font-semibold text-[#F9FAFB]">{formatAmount(withdrawalFee)}</p>
          <p className="mt-2 text-sm text-[#9CA3AF]">USDT flat fee</p>
        </div>
        <div className={cardClass}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
            Minimum Withdrawal
          </p>
          <p className="mt-6 text-[30px] font-semibold text-[#F9FAFB]">10</p>
          <p className="mt-2 text-sm text-[#9CA3AF]">USDT</p>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cardClass}>
          <div className="border-b border-[#1F2937] pb-4">
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Withdrawal Request</h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Withdrawals are processed manually after control-tower approval. Your balance is debited only when the request is approved.
            </p>
          </div>

          <form className="mt-5 space-y-5" onSubmit={openConfirm}>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {networks.map((network) => (
                <button
                  key={network}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, network }))}
                  className={
                    form.network === network
                      ? 'h-10 whitespace-nowrap rounded-md bg-[#F5A623] px-4 text-sm font-semibold text-[#0A0E1A]'
                      : 'h-10 whitespace-nowrap rounded-md border border-[#1F2937] bg-[#0A0E1A] px-4 text-sm font-semibold text-[#F9FAFB] transition hover:border-[#334155] hover:bg-[#131B2B]'
                  }
                >
                  {network}
                </button>
              ))}
            </div>

            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                  label="Amount"
                  type="number"
                  inputMode="decimal"
                  min="10"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  className="h-11 bg-[#111827]"
                  required
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="mb-[1px] h-11 px-4"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      amount: String(Math.max(availableBalance, 0)),
                    }))
                  }
                >
                  MAX
                </Button>
              </div>
              <p className="mt-2 text-sm text-[#9CA3AF]">
                Fee: {formatAmount(withdrawalFee)} USDT | You receive: {formatAmount(receiveAmount)} USDT
              </p>
              <p className="mt-1 text-sm text-[#9CA3AF]">Available: {formatAmount(availableBalance)} USDT</p>
            </div>

            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              <Input
                label="Destination Address"
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                placeholder="Your external USDT wallet address"
                className="h-11 bg-[#111827] font-mono"
                required
              />
              <div className="mt-3 flex items-start gap-3 rounded-md border border-[#7C5A15] bg-[#2A1E08] px-4 py-3 text-sm text-[#FDE68A]">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                <p>Double-check this address. Blockchain withdrawals cannot be reversed.</p>
              </div>
            </div>

            <Button type="submit" variant="danger" className="h-11 w-full justify-center">
              Submit Withdrawal Request
            </Button>

            <p className="text-sm leading-6 text-[#9CA3AF]">
              Withdrawals require admin approval and may take 1-2 business days. Pending requests do not reduce your balance until they are approved.
            </p>
          </form>
        </div>

        <div className={cardClass}>
          <div className="border-b border-[#1F2937] pb-4">
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Withdrawal History</h2>
          </div>

          {loading ? (
            <div className="mt-5 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full bg-[#1A2234]" />
              ))}
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-md border border-[#1F2937] bg-[#0A0E1A]">
                <ArrowRightLeft className="h-6 w-6 text-[#9CA3AF]" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-semibold text-[#F9FAFB]">No withdrawals yet</p>
                <p className="max-w-sm text-sm leading-6 text-[#9CA3AF]">
                  Your withdrawal requests will appear here after the first submission.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    <th className="border-b border-[#1F2937] pb-3 pr-4 text-right">Amount</th>
                    <th className="border-b border-[#1F2937] pb-3 pr-4">Network</th>
                    <th className="border-b border-[#1F2937] pb-3 pr-4">Address</th>
                    <th className="border-b border-[#1F2937] pb-3 pr-4">Status</th>
                    <th className="border-b border-[#1F2937] pb-3">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#0D1320]/70">
                      <td className="border-b border-[#1F2937] py-4 pr-4 text-right font-semibold text-[#F9FAFB]">
                        -{formatAmount(entry.amount)} USDT
                      </td>
                      <td className="border-b border-[#1F2937] py-4 pr-4 text-[#F9FAFB]">
                        {entry.network}
                      </td>
                      <td
                        className="border-b border-[#1F2937] py-4 pr-4 font-mono text-xs text-[#D1D5DB]"
                        title={entry.toAddress}
                      >
                        {shortenAddress(entry.toAddress)}
                      </td>
                      <td className="border-b border-[#1F2937] py-4 pr-4">
                        <WithdrawalStatusPill status={entry.status} />
                      </td>
                      <td className="border-b border-[#1F2937] py-4 text-[#9CA3AF]">
                        {formatDateTime(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Withdrawal"
        description={`You are withdrawing ${formatAmount(amount)} USDT to ${form.address}. You will receive ${formatAmount(receiveAmount)} USDT after the ${formatAmount(withdrawalFee)} USDT fee.`}
        confirmLabel="Confirm Withdrawal"
        loading={submitting}
        tone="danger"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submitWithdrawal()}
      >
        <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4 text-sm text-[#9CA3AF]">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 flex-none text-[#F5A623]" />
            <p>This request cannot be undone after approval. Confirm the amount, network, and destination address carefully.</p>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  )
}
