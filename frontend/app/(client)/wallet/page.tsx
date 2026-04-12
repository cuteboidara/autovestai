'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine, FileText, Wallet2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { walletApi } from '@/services/api/wallet'
import { useNotificationStore } from '@/store/notification-store'
import { useWalletStore } from '@/store/wallet-store'
import { WalletTransaction } from '@/types/wallet'

const cardClass =
  'rounded-md border border-[#1F2937] bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.28)]'

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

function StatusPill({
  status,
  type,
}: {
  status: WalletTransaction['status']
  type: WalletTransaction['type']
}) {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#0E3127] px-2.5 py-1 text-xs font-medium text-[#A7F3D0]">
        <span className="h-2 w-2 rounded-full bg-[#10B981]" />
        Completed
      </span>
    )
  }

  if (status === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#0E3127] px-2.5 py-1 text-xs font-medium text-[#A7F3D0]">
        <span className="h-2 w-2 rounded-full bg-[#10B981]" />
        {type === 'WITHDRAW' ? 'Approved' : 'Approved'}
      </span>
    )
  }

  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#3A2A0E] px-2.5 py-1 text-xs font-medium text-[#FCD34D]">
        <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
        Pending
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#3A1217] px-2.5 py-1 text-xs font-medium text-[#FCA5A5]">
      <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
      Failed
    </span>
  )
}

export default function WalletPage() {
  const router = useRouter()
  const wallet = useWalletStore((state) => state.wallet)
  const transactions = useWalletStore((state) => state.transactions)
  const setSnapshot = useWalletStore((state) => state.setSnapshot)
  const pushNotification = useNotificationStore((state) => state.push)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    void walletApi
      .getWallet()
      .then((snapshot) => {
        if (active) {
          setSnapshot(snapshot)
        }
      })
      .catch((error) => {
        if (active) {
          pushNotification({
            title: 'Wallet unavailable',
            description: error instanceof Error ? error.message : 'Unable to load wallet data.',
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
  }, [pushNotification, setSnapshot])

  const pendingDeposits = useMemo(
    () => transactions.filter((entry) => entry.type === 'DEPOSIT' && entry.status === 'PENDING').length,
    [transactions],
  )
  const pendingWithdrawals = useMemo(
    () => transactions.filter((entry) => entry.type === 'WITHDRAW' && entry.status === 'PENDING').length,
    [transactions],
  )

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Client Portal / Wallet
        </p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#F9FAFB]">Wallet</h1>
      </header>

      <section className="grid gap-4 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={cardClass}>
              <Skeleton className="h-3 w-28 bg-[#1A2234]" />
              <Skeleton className="mt-6 h-10 w-40 bg-[#1A2234]" />
              <Skeleton className="mt-2 h-4 w-16 bg-[#1A2234]" />
              <Skeleton className="mt-6 h-4 w-28 bg-[#1A2234]" />
            </div>
          ))
        ) : (
          <>
            <div className={cardClass}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Total Balance
              </p>
              <p className="mt-6 text-[32px] font-semibold leading-none text-[#F9FAFB]">
                {formatAmount(wallet?.balance)}
              </p>
              <p className="mt-2 text-sm text-[#9CA3AF]">USDT</p>
              <p className="mt-6 text-sm text-[#10B981]">Available to trade</p>
            </div>
            <div className={cardClass}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Equity
              </p>
              <p className="mt-6 text-[32px] font-semibold leading-none text-[#F9FAFB]">
                {formatAmount(wallet?.equity)}
              </p>
              <p className="mt-2 text-sm text-[#9CA3AF]">USDT</p>
              <p className="mt-6 text-sm text-[#9CA3AF]">Includes open P&amp;L</p>
            </div>
            <div className={cardClass}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Pending Deposits
              </p>
              <p className="mt-6 text-[32px] font-semibold leading-none text-[#F9FAFB]">
                {pendingDeposits}
              </p>
              <p className="mt-2 text-sm text-[#9CA3AF]">transactions</p>
              <button
                type="button"
                onClick={() => router.push('/deposit')}
                className="mt-6 text-sm font-medium text-[#F5A623] transition hover:text-[#FFBC47]"
              >
                View deposit desk →
              </button>
            </div>
            <div className={cardClass}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Pending Withdrawals
              </p>
              <p className="mt-6 text-[32px] font-semibold leading-none text-[#F9FAFB]">
                {pendingWithdrawals}
              </p>
              <p className="mt-2 text-sm text-[#9CA3AF]">transactions</p>
              <button
                type="button"
                onClick={() => router.push('/withdraw')}
                className="mt-6 text-sm font-medium text-[#F5A623] transition hover:text-[#FFBC47]"
              >
                View withdrawal desk →
              </button>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => router.push('/deposit')}
          className="flex h-11 items-center justify-center gap-2 rounded-md bg-[#F5A623] px-5 text-sm font-semibold text-[#0A0E1A] transition hover:bg-[#FFBC47]"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Deposit USDT
        </button>
        <button
          type="button"
          onClick={() => router.push('/withdraw')}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-[#1F2937] bg-[#111827] px-5 text-sm font-semibold text-[#F9FAFB] transition hover:border-[#334155] hover:bg-[#131B2B]"
        >
          <ArrowUpFromLine className="h-4 w-4" />
          Withdraw USDT
        </button>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className={cardClass}>
          <div className="border-b border-[#1F2937] pb-4">
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Wallet Overview</h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">
              Manage deposits and withdrawals through the dedicated desks. Your latest balance and account activity stay synced here.
            </p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Free Margin
              </p>
              <p className="mt-4 text-xl font-semibold text-[#F9FAFB]">
                {formatAmount(wallet?.freeMargin)}
              </p>
            </div>
            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Unrealized P&amp;L
              </p>
              <p className="mt-4 text-xl font-semibold text-[#F9FAFB]">
                {formatAmount(wallet?.unrealizedPnl)}
              </p>
            </div>
            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Used Margin
              </p>
              <p className="mt-4 text-xl font-semibold text-[#F9FAFB]">
                {formatAmount(wallet?.usedMargin)}
              </p>
            </div>
            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Margin Level
              </p>
              <p className="mt-4 text-xl font-semibold text-[#F9FAFB]">
                {wallet?.marginLevel != null ? `${formatAmount(wallet.marginLevel)}%` : '--'}
              </p>
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <div className="border-b border-[#1F2937] pb-4">
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Funding Notes</h2>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-6 text-[#9CA3AF]">
            <div className="rounded-md border border-[#7C5A15] bg-[#2A1E08] p-4 text-[#FDE68A]">
              Send only USDT on TRC20 or ERC20 to your assigned address. Any other token or network can result in permanent loss.
            </div>
            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              Deposits are credited only after on-chain confirmation and manual admin approval.
            </div>
            <div className="rounded-md border border-[#1F2937] bg-[#0A0E1A] p-4">
              Withdrawals remain pending until approval. Your balance is only reduced when the request is approved.
            </div>
          </div>
        </div>
      </section>

      <section className={cardClass}>
        <div className="border-b border-[#1F2937] pb-4">
          <h2 className="text-lg font-semibold text-[#F9FAFB]">Recent Activity</h2>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Deposits, withdrawals, and trading balance events on your active account.
          </p>
        </div>

        {loading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full bg-[#1A2234]" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-[#1F2937] bg-[#0A0E1A]">
              <FileText className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[#F9FAFB]">No transactions yet</p>
              <p className="max-w-sm text-sm leading-6 text-[#9CA3AF]">
                Your deposits, withdrawals, and balance activity will appear here.
              </p>
            </div>
            <Button className="h-11 px-5" onClick={() => router.push('/deposit')}>
              Make a Deposit
            </Button>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                  <th className="border-b border-[#1F2937] pb-3 pr-4">Date</th>
                  <th className="border-b border-[#1F2937] pb-3 pr-4">Type</th>
                  <th className="border-b border-[#1F2937] pb-3 pr-4 text-right">Amount</th>
                  <th className="border-b border-[#1F2937] pb-3 pr-4">Status</th>
                  <th className="border-b border-[#1F2937] pb-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#0D1320]/70">
                    <td className="border-b border-[#1F2937] py-4 pr-4 text-[#D1D5DB]">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="border-b border-[#1F2937] py-4 pr-4 text-[#F9FAFB]">
                      {entry.type === 'WITHDRAW'
                        ? 'Withdrawal'
                        : entry.type === 'TRADE'
                          ? 'Trade'
                          : 'Deposit'}
                    </td>
                    <td className="border-b border-[#1F2937] py-4 pr-4 text-right font-semibold text-[#F9FAFB]">
                      {entry.type === 'DEPOSIT' ? '+' : entry.type === 'WITHDRAW' ? '-' : ''}
                      {formatAmount(entry.amount)} {entry.asset}
                    </td>
                    <td className="border-b border-[#1F2937] py-4 pr-4">
                      <StatusPill status={entry.status} type={entry.type} />
                    </td>
                    <td className="border-b border-[#1F2937] py-4 font-mono text-xs text-[#9CA3AF]">
                      {entry.reference ?? 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
