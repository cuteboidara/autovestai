'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Copy, Wallet2 } from 'lucide-react'
import QRCode from 'react-qr-code'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { walletApi } from '@/services/api/wallet'
import { useNotificationStore } from '@/store/notification-store'
import { PlatformDepositWallet, SupportedDepositNetwork, WalletDeposit } from '@/types/wallet'

const cardClass =
  'rounded-2xl border border-[#1F2937] bg-[#111827] p-4 shadow-[0_18px_40px_rgba(2,6,23,0.28)] sm:p-5 lg:p-6'

const DEFAULT_MIN_DEPOSIT = 10

const networkMetaMap: Record<
  string,
  {
    title: string
    displayLabel: string
    confirmationNote: string
    feeNote: string
    confirmationsNeeded: string
    eta: string
    infoCopy: string
    recommended?: boolean
  }
> = {
  TRC20: {
    title: 'TRC20',
    displayLabel: 'TRON (TRC20)',
    confirmationNote: '~1 min confirmation',
    feeNote: 'Near-zero fees',
    confirmationsNeeded: '1',
    eta: '~1 minute',
    infoCopy:
      'TRC20 deposits typically confirm quickly, but the trading balance updates only after finance review.',
    recommended: true,
  },
  ERC20: {
    title: 'ERC20',
    displayLabel: 'Ethereum (ERC20)',
    confirmationNote: '~5 min confirmation',
    feeNote: 'Higher gas fees',
    confirmationsNeeded: '3',
    eta: '~5 minutes',
    infoCopy:
      'ERC20 deposits are supported, but network fees are higher and confirmation time depends on Ethereum congestion.',
  },
  BEP20: {
    title: 'BEP20',
    displayLabel: 'BNB Smart Chain (BEP20)',
    confirmationNote: '~1-2 min confirmation',
    feeNote: 'Low fees',
    confirmationsNeeded: '3',
    eta: '~2 minutes',
    infoCopy:
      'BEP20 deposits reach the platform wallet quickly, but manual finance verification is still required before crediting.',
  },
  BTC: {
    title: 'Bitcoin',
    displayLabel: 'Bitcoin',
    confirmationNote: '~10 min per block',
    feeNote: 'Fee varies by mempool load',
    confirmationsNeeded: '1-3',
    eta: '~10-30 minutes',
    infoCopy:
      'Bitcoin transfers can take longer to settle. Wait for blockchain confirmation, then finance can review the transfer manually.',
  },
}

function formatAmount(value: number | null | undefined, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value ?? NaN) ? value ?? 0 : 0)
}

function formatAssetAmount(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) {
    return formatAmount(0)
  }

  const absoluteValue = Math.abs(value ?? 0)

  if (absoluteValue > 0 && absoluteValue < 1) {
    return formatAmount(value, 6)
  }

  return formatAmount(value, 2)
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

function getWalletMeta(wallet: PlatformDepositWallet | null) {
  const network = wallet?.network.trim().toUpperCase() ?? ''

  return (
    networkMetaMap[network] ?? {
      title: network || 'Custom network',
      displayLabel: wallet?.network || 'Custom network',
      confirmationNote: 'Confirmation time varies by network',
      feeNote: 'Blockchain fees depend on network congestion',
      confirmationsNeeded: 'Varies',
      eta: 'Varies',
      infoCopy:
        'After sending, wait for blockchain confirmation and finance review before expecting the balance to update.',
    }
  )
}

function isDeclarationSupported(wallet: PlatformDepositWallet | null) {
  if (!wallet) {
    return false
  }

  const network = wallet.network.trim().toUpperCase()
  const coin = wallet.coin.trim().toUpperCase()

  return coin === 'USDT' && (network === 'TRC20' || network === 'ERC20')
}

function walletDisplayTitle(wallet: PlatformDepositWallet) {
  const meta = getWalletMeta(wallet)
  return `${wallet.coin} on ${meta.displayLabel}`
}

function DepositStatusPill({ deposit }: { deposit: WalletDeposit }) {
  if (deposit.approvalStatus === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#3A1217] px-2.5 py-1 text-xs font-medium text-[#FCA5A5]">
        <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
        Rejected
      </span>
    )
  }

  if (
    deposit.approvalStatus === 'APPROVED' ||
    deposit.approvalStatus === 'COMPLETED' ||
    deposit.creditedAt
  ) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#0E3127] px-2.5 py-1 text-xs font-medium text-[#A7F3D0]">
        <span className="h-2 w-2 rounded-full bg-[#10B981]" />
        Credited
      </span>
    )
  }

  if (deposit.status === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#1E293B] px-2.5 py-1 text-xs font-medium text-[#BFDBFE]">
        <span className="h-2 w-2 rounded-full bg-[#60A5FA]" />
        Awaiting approval
      </span>
    )
  }

  if (deposit.status === 'CONFIRMING' || deposit.status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-[#3A2A0E] px-2.5 py-1 text-xs font-medium text-[#FCD34D]">
        <span className="h-2 w-2 rounded-full bg-[#F5A623]" />
        {deposit.status === 'CONFIRMING' ? 'Confirming' : 'Pending'}
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
  const [platformWallets, setPlatformWallets] = useState<PlatformDepositWallet[]>([])
  const [walletsLoading, setWalletsLoading] = useState(true)
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [step, setStep] = useState<'amount' | 'address'>('amount')
  const [copySuccess, setCopySuccess] = useState(false)
  const [declaringDeposit, setDeclaringDeposit] = useState(false)
  const [depositDeclared, setDepositDeclared] = useState(false)

  const parsedAmount = Number.parseFloat(amountInput)
  const selectedWallet = useMemo(
    () => platformWallets.find((wallet) => wallet.id === selectedWalletId) ?? platformWallets[0] ?? null,
    [platformWallets, selectedWalletId],
  )
  const selectedMeta = useMemo(() => getWalletMeta(selectedWallet), [selectedWallet])
  const supportsDeclaration = useMemo(
    () => isDeclarationSupported(selectedWallet),
    [selectedWallet],
  )
  const minimumDeposit = selectedWallet?.minDeposit ?? DEFAULT_MIN_DEPOSIT
  const isAmountValid =
    !supportsDeclaration ||
    (Number.isFinite(parsedAmount) && parsedAmount >= minimumDeposit)

  useEffect(() => {
    let active = true

    void walletApi
      .getPlatformDepositWallets()
      .then((data) => {
        if (active) {
          setPlatformWallets(data)
        }
      })
      .catch(() => {
        if (active) {
          setPlatformWallets([])
        }
      })
      .finally(() => {
        if (active) {
          setWalletsLoading(false)
        }
      })

    void walletApi
      .listDeposits()
      .then((depositHistory) => {
        if (active) {
          setDeposits(depositHistory)
        }
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
    if (platformWallets.length === 0) {
      setSelectedWalletId('')
      return
    }

    const currentWalletExists = platformWallets.some((wallet) => wallet.id === selectedWalletId)

    if (currentWalletExists) {
      return
    }

    const preferredWallet =
      platformWallets.find(
        (wallet) =>
          wallet.network.trim().toUpperCase() === 'TRC20' &&
          wallet.coin.trim().toUpperCase() === 'USDT',
      ) ?? platformWallets[0]

    setSelectedWalletId(preferredWallet.id)
  }, [platformWallets, selectedWalletId])

  useEffect(() => {
    setCopySuccess(false)
    setDepositDeclared(false)
  }, [selectedWalletId, step])

  async function handleDeclareDeposit() {
    if (
      declaringDeposit ||
      depositDeclared ||
      !selectedWallet ||
      !supportsDeclaration ||
      !isAmountValid
    ) {
      return
    }

    setDeclaringDeposit(true)

    try {
      await walletApi.requestDeposit({
        amount: parsedAmount,
        network: selectedWallet.network as SupportedDepositNetwork,
        asset: 'USDT',
        platformWalletId: selectedWallet.id,
        depositAddress: selectedWallet.address,
      })

      setDepositDeclared(true)
      pushNotification({
        title: 'Deposit declaration received',
        description:
          'Your deposit is pending finance review. Your trading balance updates after manual approval.',
        type: 'success',
      })

      const updated = await walletApi.listDeposits()
      setDeposits(updated)
    } catch (error) {
      pushNotification({
        title: 'Declaration failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to submit the deposit declaration. Please try again.',
        type: 'error',
      })
    } finally {
      setDeclaringDeposit(false)
    }
  }

  function handleContinue() {
    if (!selectedWallet || !isAmountValid) {
      return
    }

    setStep('address')
  }

  async function handleCopy() {
    if (!selectedWallet?.address || typeof navigator === 'undefined' || !navigator.clipboard) {
      pushNotification({
        title: 'Copy unavailable',
        description: 'Clipboard access is not available in this browser session.',
        type: 'error',
      })
      return
    }

    await navigator.clipboard.writeText(selectedWallet.address)
    setCopySuccess(true)
    pushNotification({
      title: 'Deposit address copied',
      description: `${walletDisplayTitle(selectedWallet)} address copied to clipboard.`,
      type: 'success',
    })
    window.setTimeout(() => setCopySuccess(false), 2000)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="max-w-3xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Client Portal / Deposit
        </p>
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#F9FAFB] sm:text-[28px] lg:text-[32px]">
          Crypto Deposit
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-[#9CA3AF]">
          Select a network, copy the platform wallet address, and send only the matching asset on
          the matching chain. Your trading balance updates after finance review.
        </p>
      </header>

      <section className="mx-auto w-full max-w-5xl">
        <div className={cardClass}>
          {step === 'amount' ? (
            <div className="space-y-6 lg:space-y-8">
              <div className="mx-auto max-w-2xl space-y-2 text-center">
                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#F9FAFB] sm:text-[28px]">
                  Choose Deposit Wallet
                </h2>
                <p className="text-sm text-[#9CA3AF]">
                  Pick the network first. If the selected wallet supports in-app declaration, enter
                  the amount before revealing the address.
                </p>
              </div>

              {walletsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24 w-full bg-[#1A2234]" />
                  <Skeleton className="h-24 w-full bg-[#1A2234]" />
                </div>
              ) : platformWallets.length === 0 ? (
                <div className="rounded-xl border border-[#7F1D1D] bg-[#2A1013] p-5">
                  <p className="text-sm font-medium text-[#FCA5A5]">
                    No active crypto deposit wallet is configured right now. Please contact support
                    before sending funds.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                      Networks
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {platformWallets.map((wallet) => {
                        const meta = getWalletMeta(wallet)
                        const selected = wallet.id === selectedWallet?.id
                        const recommended =
                          meta.recommended && wallet.coin.trim().toUpperCase() === 'USDT'

                        return (
                          <button
                            key={wallet.id}
                            type="button"
                            onClick={() => setSelectedWalletId(wallet.id)}
                            aria-pressed={selected}
                            className={
                              selected
                                ? 'h-full rounded-xl border border-[#F5A623] bg-[#1B1407] p-4 text-left shadow-[0_0_0_1px_rgba(245,166,35,0.12)] transition'
                                : 'h-full rounded-xl border border-[#1F2937] bg-[#0A0E1A] p-4 text-left transition hover:border-[#334155] hover:bg-[#101827]'
                            }
                          >
                            <div className="flex h-full flex-col gap-3">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-base font-semibold text-[#F9FAFB]">
                                    {wallet.network}
                                  </p>
                                  <p className="mt-1 text-sm text-[#D1D5DB]">{wallet.coin}</p>
                                </div>
                                {recommended ? (
                                  <span
                                    className={
                                      selected
                                        ? 'inline-flex self-start rounded-full bg-[#F5A623] px-2.5 py-1 text-xs font-semibold text-[#0A0E1A]'
                                        : 'inline-flex self-start rounded-full border border-[#7C5A15] bg-[#2A1E08] px-2.5 py-1 text-xs font-semibold text-[#FDE68A]'
                                    }
                                  >
                                    Recommended
                                  </span>
                                ) : null}
                              </div>
                              <div className="space-y-1">
                                <p className="text-base font-semibold text-[#F9FAFB]">
                                  {meta.displayLabel}
                                </p>
                                <p className="mt-2 text-sm text-[#D1D5DB]">{meta.confirmationNote}</p>
                                <p className="mt-1 text-sm text-[#9CA3AF]">{meta.feeNote}</p>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {selectedWallet ? (
                    supportsDeclaration ? (
                      <div className="space-y-3">
                        <Input
                          label={`Amount (${selectedWallet.coin})`}
                          type="number"
                          inputMode="decimal"
                          min={String(minimumDeposit)}
                          step="0.01"
                          placeholder="0.00"
                          value={amountInput}
                          onChange={(event) => setAmountInput(event.target.value)}
                          className="h-14 border-[#334155] bg-[#0A0E1A] px-4 text-center text-3xl font-semibold tracking-[-0.03em] text-[#F9FAFB] sm:h-16 sm:px-5 sm:text-4xl"
                        />
                        <p className="text-center text-sm text-[#9CA3AF]">
                          Minimum deposit: {formatAssetAmount(minimumDeposit)} {selectedWallet.coin}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#1D4ED8] bg-[#0B1733] px-4 py-4 text-sm leading-6 text-[#BFDBFE]">
                        In-app declaration currently supports USDT on TRC20 and ERC20 only. You can
                        still copy this wallet address and send {selectedWallet.coin}, but manual
                        review will require the blockchain transaction hash.
                      </div>
                    )
                  ) : null}
                </>
              )}

              <Button
                className="h-12 w-full text-base font-semibold sm:h-14"
                disabled={!selectedWallet || walletsLoading || platformWallets.length === 0 || !isAmountValid}
                onClick={handleContinue}
              >
                {supportsDeclaration ? 'Continue' : 'Show Wallet Address'}
              </Button>
            </div>
          ) : (
            <div className="space-y-5 lg:space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={() => setStep('amount')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#1F2937] bg-[#0A0E1A] text-[#F9FAFB] transition hover:border-[#334155] hover:bg-[#131B2B]"
                  aria-label="Back to wallet selection"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1 rounded-xl border border-[#5B4212] bg-[#2A1E08] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#F6C56B]">
                    Selected wallet
                  </p>
                  <p className="mt-1 break-words text-sm font-medium leading-6 text-[#FDE68A]">
                    {selectedWallet ? walletDisplayTitle(selectedWallet) : 'No wallet selected'}
                  </p>
                </div>
              </div>

              {!selectedWallet ? (
                <div className="rounded-xl border border-[#7F1D1D] bg-[#2A1013] p-5">
                  <p className="text-sm font-medium text-[#FCA5A5]">
                    No deposit wallet is configured. Please contact support.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
                  <div className="min-w-0 space-y-4">
                    <div className="rounded-xl border border-[#7C5A15] bg-[#2A1E08] px-4 py-4 text-sm text-[#FDE68A]">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                        <p className="leading-6">
                          Only send {selectedWallet.coin} on {selectedWallet.network}. Sending the
                          wrong token or the wrong network will result in permanent loss.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#1F2937] bg-[#0A0E1A] p-4 sm:p-5">
                      <div className="flex justify-center">
                        <div className="w-full max-w-[280px] rounded-[24px] border border-[#1F2937] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.25)] sm:p-5">
                          <QRCode
                            value={selectedWallet.address}
                            size={256}
                            bgColor="#FFFFFF"
                            fgColor="#0A0E1A"
                            style={{ height: 'auto', width: '100%' }}
                          />
                        </div>
                      </div>
                      <p className="mt-4 text-center text-sm leading-6 text-[#9CA3AF]">
                        Scan the QR code with the exact {selectedWallet.network} wallet, or copy the
                        address below.
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#1F2937] bg-[#0A0E1A] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9CA3AF]">
                        Deposit address
                      </p>
                      <p className="mt-3 break-all font-mono text-xs text-[#F9FAFB] sm:text-sm">
                        {selectedWallet.address}
                      </p>
                      <Button
                        variant={copySuccess ? 'success' : 'secondary'}
                        className="mt-4 h-11 w-full"
                        onClick={() => void handleCopy()}
                      >
                        {copySuccess ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copySuccess ? 'Copied ✓' : 'Copy Address'}
                      </Button>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="rounded-xl border border-[#1F2937] bg-[#0A0E1A]">
                      {[
                        ['Network', selectedMeta.displayLabel],
                        ['Coin / token', selectedWallet.coin],
                        [
                          'Minimum deposit',
                          `${formatAssetAmount(selectedWallet.minDeposit)} ${selectedWallet.coin}`,
                        ],
                        ['Confirmations needed', selectedMeta.confirmationsNeeded],
                        ['Expected confirmation', selectedMeta.eta],
                        ...(supportsDeclaration
                          ? [['Declared amount', `${formatAssetAmount(parsedAmount)} ${selectedWallet.coin}`]]
                          : []),
                      ].map(([label, value], index) => (
                        <div
                          key={label}
                          className={
                            index === 0
                              ? 'flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
                              : 'flex flex-col gap-1.5 border-t border-[#1F2937] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'
                          }
                        >
                          <span className="text-sm text-[#9CA3AF]">{label}</span>
                          <span className="break-words text-sm font-medium text-[#F9FAFB] sm:max-w-[55%] sm:text-right">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-[#1D4ED8] bg-[#0B1733] px-4 py-4 text-sm leading-6 text-[#BFDBFE]">
                      {selectedMeta.infoCopy}
                    </div>

                    {supportsDeclaration ? (
                      depositDeclared ? (
                        <div className="rounded-xl border border-[#065F46] bg-[#022C22] px-5 py-4">
                          <div className="flex items-start gap-3">
                            <Check className="mt-0.5 h-5 w-5 flex-none text-[#10B981]" />
                            <div>
                              <p className="font-semibold text-[#A7F3D0]">
                                Deposit declared successfully
                              </p>
                              <p className="mt-1 text-sm leading-6 text-[#6EE7B7]">
                                Your deposit of {formatAssetAmount(parsedAmount)} USDT via{' '}
                                {selectedWallet.network} is pending finance review.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <Button
                          className="h-14 w-full text-base font-semibold"
                          disabled={declaringDeposit}
                          onClick={() => void handleDeclareDeposit()}
                        >
                          {declaringDeposit ? 'Submitting…' : 'I Have Sent the Money'}
                        </Button>
                      )
                    ) : (
                      <div className="rounded-xl border border-[#7C5A15] bg-[#2A1E08] px-4 py-4 text-sm leading-6 text-[#FDE68A]">
                        After you send {selectedWallet.coin}, keep the transaction hash and contact
                        support or the finance desk for manual review.
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                Your deposit history will appear here after the first declaration or blockchain
                detection.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="space-y-3 sm:hidden">
              {deposits.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-[#1F2937] bg-[#0A0E1A] p-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                          Transaction
                        </p>
                        {entry.txHash ? (
                          <p className="mt-2 break-all font-mono text-xs text-[#D1D5DB]">
                            {entry.txHash}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm italic text-[#9CA3AF]">Manual declaration</p>
                        )}
                      </div>
                      <DepositStatusPill deposit={entry} />
                    </div>
                    <dl className="grid gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-sm text-[#9CA3AF]">Amount</dt>
                        <dd className="text-right text-sm font-semibold text-[#10B981]">
                          +{formatAssetAmount(entry.usdtAmount)} USDT
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-sm text-[#9CA3AF]">Network</dt>
                        <dd className="text-right text-sm text-[#F9FAFB]">
                          {entry.network ?? '—'}
                        </dd>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <dt className="text-sm text-[#9CA3AF]">Date</dt>
                        <dd className="text-right text-sm text-[#9CA3AF]">
                          {formatDateTime(entry.createdAt)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-[720px] w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    <th className="border-b border-[#1F2937] pb-3 pr-4 whitespace-nowrap">TxHash</th>
                    <th className="border-b border-[#1F2937] pb-3 pr-4 text-right whitespace-nowrap">
                      Amount
                    </th>
                    <th className="border-b border-[#1F2937] pb-3 pr-4 whitespace-nowrap">Network</th>
                    <th className="border-b border-[#1F2937] pb-3 pr-4 whitespace-nowrap">Status</th>
                    <th className="border-b border-[#1F2937] pb-3 whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((entry) => (
                    <tr key={entry.id} className="hover:bg-[#0D1320]/70">
                      <td
                        className="max-w-[220px] border-b border-[#1F2937] py-4 pr-4 font-mono text-xs text-[#D1D5DB] whitespace-nowrap"
                        title={entry.txHash ?? undefined}
                      >
                        {entry.txHash ? (
                          shortenHash(entry.txHash)
                        ) : (
                          <span className="text-[#9CA3AF] italic">Manual declaration</span>
                        )}
                      </td>
                      <td className="border-b border-[#1F2937] py-4 pr-4 text-right font-semibold text-[#10B981] whitespace-nowrap">
                        +{formatAssetAmount(entry.usdtAmount)} USDT
                      </td>
                      <td className="border-b border-[#1F2937] py-4 pr-4 text-[#F9FAFB] whitespace-nowrap">
                        {entry.network ?? '—'}
                      </td>
                      <td className="border-b border-[#1F2937] py-4 pr-4 whitespace-nowrap">
                        <DepositStatusPill deposit={entry} />
                      </td>
                      <td className="border-b border-[#1F2937] py-4 text-[#9CA3AF] whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
