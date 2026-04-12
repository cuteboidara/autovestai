'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Copy, Wallet2 } from 'lucide-react'
import QRCode from 'react-qr-code'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { walletApi } from '@/services/api/wallet'
import { useNotificationStore } from '@/store/notification-store'
import { DepositAddressResponse, WalletDeposit, WalletNetwork } from '@/types/wallet'

const cardClass =
  'rounded-md border border-[#1F2937] bg-[#111827] p-5 shadow-[0_18px_40px_rgba(2,6,23,0.28)]'

const MIN_DEPOSIT = 10

const networks: Array<{
  network: WalletNetwork
  title: string
  displayLabel: string
  confirmationNote: string
  feeNote: string
  recommended?: boolean
  confirmationsNeeded: string
  eta: string
  infoCopy: string
}> = [
  {
    network: 'TRC20',
    title: 'TRC20 — TRON',
    displayLabel: 'TRON (TRC20)',
    confirmationNote: '~1 min confirmation',
    feeNote: 'Near-zero fees',
    recommended: true,
    confirmationsNeeded: '1',
    eta: '~1 minute',
    infoCopy:
      'After sending, your balance will be credited automatically once the transaction is confirmed on the blockchain. This usually takes under 1 minute for TRC20.',
  },
  {
    network: 'ERC20',
    title: 'ERC20 — Ethereum',
    displayLabel: 'Ethereum (ERC20)',
    confirmationNote: '~5 min confirmation',
    feeNote: 'Higher gas fees',
    confirmationsNeeded: '3',
    eta: '~5 minutes',
    infoCopy:
      'After sending, your balance will be credited automatically once the transaction is confirmed on the blockchain. This usually takes around 5 minutes for ERC20.',
  },
]

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

function shortenHash(value: string) {
  if (value.length <= 16) {
    return value
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

function DepositStatusPill({ status }: { status: WalletDeposit['status'] }) {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#0E3127] px-2.5 py-1 text-xs font-medium text-[#A7F3D0]">
        <span className="h-2 w-2 rounded-full bg-[#10B981]" />
        Completed
      </span>
    )
  }

  if (status === 'CONFIRMING' || status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#3A2A0E] px-2.5 py-1 text-xs font-medium text-[#FCD34D]">
        <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
        {status === 'CONFIRMING' ? 'Confirming' : 'Pending'}
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

export default function DepositPage() {
  const pushNotification = useNotificationStore((state) => state.push)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [deposits, setDeposits] = useState<WalletDeposit[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<WalletNetwork>('TRC20')
  const [amountInput, setAmountInput] = useState('')
  const [step, setStep] = useState<'amount' | 'address'>('amount')
  const [copySuccess, setCopySuccess] = useState(false)
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [addressBook, setAddressBook] = useState<Partial<Record<WalletNetwork, DepositAddressResponse>>>({})

  const parsedAmount = Number.parseFloat(amountInput)
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount >= MIN_DEPOSIT
  const selectedMeta = useMemo(
    () => networks.find((entry) => entry.network === selectedNetwork) ?? networks[0],
    [selectedNetwork],
  )
  const selectedAddress = addressBook[selectedNetwork] ?? null

  useEffect(() => {
    let active = true

    void walletApi
      .listDeposits()
      .then((depositHistory) => {
        if (!active) {
          return
        }

        setDeposits(depositHistory)
      })
      .catch((error) => {
        if (active) {
          pushNotification({
            title: 'Deposit history unavailable',
            description: error instanceof Error ? error.message : 'Unable to load deposit history.',
            type: 'error',
          })
        }
      })
      .finally(() => {
        if (active) {
          setHistoryLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [pushNotification])

  useEffect(() => {
    setCopySuccess(false)
  }, [selectedNetwork, step])

  async function loadDepositAddress(network: WalletNetwork, force = false) {
    if (!force && addressBook[network]) {
      setAddressError(null)
      return addressBook[network] ?? null
    }

    setAddressLoading(true)
    setAddressError(null)

    try {
      const response = await walletApi.getDepositAddress(network)
      setAddressBook((current) => ({
        ...current,
        [network]: response,
      }))
      return response
    } catch (_error) {
      setAddressError('Unable to load deposit address. Please try again.')
      return null
    } finally {
      setAddressLoading(false)
    }
  }

  async function handleContinue() {
    if (!isAmountValid) {
      return
    }

    setStep('address')
    await loadDepositAddress(selectedNetwork)
  }

  async function handleRetry() {
    await loadDepositAddress(selectedNetwork, true)
  }

  async function handleCopy() {
    if (!selectedAddress?.address || typeof navigator === 'undefined' || !navigator.clipboard) {
      pushNotification({
        title: 'Copy unavailable',
        description: 'Clipboard access is not available in this browser session.',
        type: 'error',
      })
      return
    }

    await navigator.clipboard.writeText(selectedAddress.address)
    setCopySuccess(true)
    pushNotification({
      title: 'Deposit address copied',
      description: `${selectedMeta.title} address copied to clipboard.`,
      type: 'success',
    })
    window.setTimeout(() => setCopySuccess(false), 2000)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Client Portal / Deposit
        </p>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#F9FAFB]">
          Deposit USDT
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[#9CA3AF]">
          Confirm the amount first, then send USDT on the matching network to your dedicated deposit address.
        </p>
      </header>

      <section className="mx-auto max-w-3xl">
        <div className={cardClass}>
          {step === 'amount' ? (
            <div className="space-y-6">
              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#F9FAFB]">
                  Deposit USDT
                </h2>
                <p className="text-sm text-[#9CA3AF]">
                  Enter the amount and choose the network before revealing your deposit address.
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  label="Amount (USDT)"
                  type="number"
                  inputMode="decimal"
                  min={String(MIN_DEPOSIT)}
                  step="0.01"
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  className="h-16 border-[#334155] bg-[#0A0E1A] px-5 text-center text-4xl font-semibold tracking-[-0.03em] text-[#F9FAFB]"
                />
                <p className="text-center text-sm text-[#9CA3AF]">
                  Minimum deposit: ${formatAmount(MIN_DEPOSIT)} USDT
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Network
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {networks.map((item) => {
                    const selected = item.network === selectedNetwork

                    return (
                      <button
                        key={item.network}
                        type="button"
                        onClick={() => setSelectedNetwork(item.network)}
                        className={
                          selected
                            ? 'rounded-xl border border-[#F5A623] bg-[#1B1407] p-4 text-left shadow-[0_0_0_1px_rgba(245,166,35,0.12)] transition'
                            : 'rounded-xl border border-[#1F2937] bg-[#0A0E1A] p-4 text-left transition hover:border-[#334155] hover:bg-[#101827]'
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold text-[#F9FAFB]">{item.title}</p>
                            <p className="mt-2 text-sm text-[#D1D5DB]">{item.confirmationNote}</p>
                            <p className="mt-1 text-sm text-[#9CA3AF]">{item.feeNote}</p>
                          </div>
                          {item.recommended ? (
                            <span
                              className={
                                selected
                                  ? 'rounded-full bg-[#F5A623] px-2.5 py-1 text-xs font-semibold text-[#0A0E1A]'
                                  : 'rounded-full border border-[#7C5A15] bg-[#2A1E08] px-2.5 py-1 text-xs font-semibold text-[#FDE68A]'
                              }
                            >
                              Recommended ✓
                            </span>
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <Button
                className="h-12 w-full text-base font-semibold"
                disabled={!isAmountValid}
                onClick={() => void handleContinue()}
              >
                Continue
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('amount')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#1F2937] bg-[#0A0E1A] text-[#F9FAFB] transition hover:border-[#334155] hover:bg-[#131B2B]"
                  aria-label="Back to amount entry"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 rounded-xl border border-[#5B4212] bg-[#2A1E08] px-4 py-3 text-sm font-medium text-[#FDE68A]">
                  You are depositing: ${formatAmount(parsedAmount)} USDT via {selectedNetwork}
                </div>
              </div>

              {addressLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full bg-[#1A2234]" />
                  <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <Skeleton className="mx-auto h-[220px] w-[220px] bg-[#1A2234]" />
                    <div className="space-y-3">
                      <Skeleton className="h-16 w-full bg-[#1A2234]" />
                      <Skeleton className="h-12 w-full bg-[#1A2234]" />
                      <Skeleton className="h-40 w-full bg-[#1A2234]" />
                    </div>
                  </div>
                </div>
              ) : addressError ? (
                <div className="rounded-xl border border-[#7F1D1D] bg-[#2A1013] p-5">
                  <p className="text-sm font-medium text-[#FCA5A5]">
                    Unable to load deposit address. Please try again.
                  </p>
                  <Button variant="secondary" className="mt-4 h-11 px-5" onClick={() => void handleRetry()}>
                    Retry
                  </Button>
                </div>
              ) : selectedAddress ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-[#7C5A15] bg-[#2A1E08] px-4 py-4 text-sm text-[#FDE68A]">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                      <p>
                        Only send USDT ({selectedNetwork}) to this address. Sending any other token
                        will result in permanent loss of funds.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="rounded-[24px] border border-[#1F2937] bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
                      <QRCode value={selectedAddress.address} size={220} bgColor="#FFFFFF" fgColor="#0A0E1A" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#1F2937] bg-[#0A0E1A] p-4">
                      <p className="break-all font-mono text-sm text-[#F9FAFB]">{selectedAddress.address}</p>
                    </div>
                    <Button
                      variant={copySuccess ? 'success' : 'secondary'}
                      className="h-11 w-full"
                      onClick={() => void handleCopy()}
                    >
                      {copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copySuccess ? 'Copied ✓' : 'Copy Address'}
                    </Button>
                  </div>

                  <div className="rounded-xl border border-[#1F2937] bg-[#0A0E1A]">
                    {[
                      ['Network', selectedMeta.displayLabel],
                      ['Token', 'USDT'],
                      ['Amount to send', `${formatAmount(parsedAmount)} USDT`],
                      ['Min deposit', `${formatAmount(MIN_DEPOSIT)} USDT`],
                      ['Confirmations needed', selectedMeta.confirmationsNeeded],
                      ['Estimated credit', selectedMeta.eta],
                    ].map(([label, value], index) => (
                      <div
                        key={label}
                        className={
                          index === 0
                            ? 'flex items-center justify-between gap-4 px-4 py-3'
                            : 'flex items-center justify-between gap-4 border-t border-[#1F2937] px-4 py-3'
                        }
                      >
                        <span className="text-sm text-[#9CA3AF]">{label}</span>
                        <span className="text-right text-sm font-medium text-[#F9FAFB]">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-[#1D4ED8] bg-[#0B1733] px-4 py-4 text-sm leading-6 text-[#BFDBFE]">
                    {selectedMeta.infoCopy}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <div className="border-b border-[#1F2937] pb-4">
          <h2 className="text-lg font-semibold text-[#F9FAFB]">Deposit History</h2>
        </div>

        {historyLoading ? (
          <div className="mt-5 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full bg-[#1A2234]" />
            ))}
          </div>
        ) : deposits.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-[#1F2937] bg-[#0A0E1A]">
              <Wallet2 className="h-6 w-6 text-[#9CA3AF]" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[#F9FAFB]">No deposits yet</p>
              <p className="max-w-sm text-sm leading-6 text-[#9CA3AF]">
                Your USDT deposit history will appear here after the first on-chain confirmation.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                  <th className="border-b border-[#1F2937] pb-3 pr-4">TxHash</th>
                  <th className="border-b border-[#1F2937] pb-3 pr-4 text-right">Amount</th>
                  <th className="border-b border-[#1F2937] pb-3 pr-4">Network</th>
                  <th className="border-b border-[#1F2937] pb-3 pr-4">Status</th>
                  <th className="border-b border-[#1F2937] pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#0D1320]/70">
                    <td className="border-b border-[#1F2937] py-4 pr-4 font-mono text-xs text-[#D1D5DB]" title={entry.txHash}>
                      {shortenHash(entry.txHash)}
                    </td>
                    <td className="border-b border-[#1F2937] py-4 pr-4 text-right font-semibold text-[#10B981]">
                      +{formatAmount(entry.usdtAmount)} USDT
                    </td>
                    <td className="border-b border-[#1F2937] py-4 pr-4 text-[#F9FAFB]">
                      {entry.network}
                    </td>
                    <td className="border-b border-[#1F2937] py-4 pr-4">
                      <DepositStatusPill status={entry.status} />
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
      </section>
    </div>
  )
}
