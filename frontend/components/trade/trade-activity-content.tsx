'use client';

import { ListPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useLiveQuote } from '@/hooks/use-live-prices';
import { calculateLivePositionPnl, getLivePositionMark } from '@/lib/trade-live-metrics';
import { cn, formatDateTime, formatNumber, formatUsdt } from '@/lib/utils';
import { OrderRecord, PositionRecord } from '@/types/trading';

export type TradeBottomTab = 'open' | 'pending' | 'closed' | 'history';

export interface TradeBottomTabMeta {
  label: string;
  shortLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}

export const TRADE_ACTIVITY_META: Record<TradeBottomTab, TradeBottomTabMeta> = {
  open: {
    label: 'Open Positions',
    shortLabel: 'Open',
    emptyTitle: 'No open positions',
    emptyDescription: 'Filled live trades will appear here once market exposure is active.',
  },
  pending: {
    label: 'Pending Orders',
    shortLabel: 'Pending',
    emptyTitle: 'No pending orders',
    emptyDescription: 'Working limit orders will appear here when they are queued for execution.',
  },
  closed: {
    label: 'Closed Positions',
    shortLabel: 'Closed',
    emptyTitle: 'No closed positions',
    emptyDescription: 'Settled positions and realized results will appear here after positions close.',
  },
  history: {
    label: 'Order History',
    shortLabel: 'History',
    emptyTitle: 'No order history',
    emptyDescription: 'Executed, rejected, and cancelled orders will appear here once routing activity starts.',
  },
};

interface TradeActivityContentProps {
  activeTab: TradeBottomTab;
  bottomTabMeta: Record<TradeBottomTab, TradeBottomTabMeta>;
  rows: Array<PositionRecord | OrderRecord>;
  symbolDigitsMap: Record<string, number>;
  closingPositionId: string | null;
  flashedPnlIds: Record<string, true>;
  onClosePosition: (positionId: string) => void;
}

interface TradeActivityCardsProps extends TradeActivityContentProps {
  mobileLimit?: number;
}

function formatTarget(
  value: number | null | undefined,
  digits: number,
) {
  return typeof value === 'number' ? formatNumber(value, digits) : '--';
}

function settledPositionPnl(position: PositionRecord) {
  return position.unrealizedPnl ?? position.pnl;
}

function sideBadge(side: 'BUY' | 'SELL') {
  return side === 'BUY'
    ? 'bg-emerald-500/10 text-emerald-300'
    : 'bg-red-500/10 text-red-300';
}

function statusBadge(status: OrderRecord['status']) {
  switch (status) {
    case 'EXECUTED':
      return 'bg-emerald-500/10 text-emerald-300';
    case 'PENDING':
    case 'OPEN':
    case 'PROCESSING':
      return 'bg-amber-500/10 text-amber-300';
    default:
      return 'bg-[var(--terminal-bg-primary)] text-[var(--terminal-text-secondary)]';
  }
}

function isOrderTab(tab: TradeBottomTab) {
  return tab === 'pending' || tab === 'history';
}

function isClosedPositionsTab(tab: TradeBottomTab) {
  return tab === 'closed';
}

const desktopHeadCellClass =
  'border-b border-[var(--terminal-border)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--terminal-text-muted)]';

const desktopRowClass =
  'text-[12px] text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[rgba(19,32,53,0.42)]';

const desktopCellClass = 'px-3 py-2.5 align-middle whitespace-nowrap';

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div
      data-testid="terminal-empty-state"
      className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center"
    >
      <div className="terminal-panel-soft flex h-10 w-10 items-center justify-center text-[var(--terminal-text-secondary)]">
        <ListPlus className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--terminal-text-primary)]">{title}</p>
        <p className="mt-2 text-[12px] text-[var(--terminal-text-secondary)]">
          {description}
        </p>
      </div>
    </div>
  );
}

export function TradeActivityTable({
  activeTab,
  bottomTabMeta,
  rows,
  symbolDigitsMap,
  closingPositionId,
  flashedPnlIds,
  onClosePosition,
}: TradeActivityContentProps) {
  const orderRows = rows as OrderRecord[];
  const positionRows = rows as PositionRecord[];

  if (rows.length === 0) {
    return (
      <EmptyState
        title={bottomTabMeta[activeTab].emptyTitle}
        description={bottomTabMeta[activeTab].emptyDescription}
      />
    );
  }

  if (isOrderTab(activeTab)) {
    return (
      <table className="min-w-[920px] w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-[rgba(7,12,20,0.98)] backdrop-blur">
          <tr>
            {['Symbol', 'Side', 'Type', 'Volume', 'Price', 'Status', 'Updated'].map((label) => (
              <th key={label} className={desktopHeadCellClass}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--terminal-border)]/60">
          {orderRows.map((row) => (
            <tr key={row.id} className={desktopRowClass}>
              <td className={cn(desktopCellClass, 'font-medium')}>
                {row.symbol}
              </td>
              <td className={desktopCellClass}>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
                    sideBadge(row.side),
                  )}
                >
                  {row.side}
                </span>
              </td>
              <td className={cn(desktopCellClass, 'text-[var(--terminal-text-secondary)]')}>
                {row.type}
              </td>
              <td className={desktopCellClass}>
                {formatNumber(row.volume, 2)}
              </td>
              <td className={desktopCellClass}>
                {row.executionPrice
                  ? formatNumber(row.executionPrice, symbolDigitsMap[row.symbol] ?? 2)
                  : row.requestedPrice
                    ? formatNumber(row.requestedPrice, symbolDigitsMap[row.symbol] ?? 2)
                    : '--'}
              </td>
              <td className={desktopCellClass}>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
                    statusBadge(row.status),
                  )}
                >
                  {row.status}
                </span>
              </td>
              <td className={cn(desktopCellClass, 'text-[var(--terminal-text-secondary)]')}>
                {formatDateTime(row.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (isClosedPositionsTab(activeTab)) {
    return (
      <table className="min-w-[1040px] w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-[rgba(7,12,20,0.98)] backdrop-blur">
          <tr>
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
              <th key={label} className={desktopHeadCellClass}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--terminal-border)]/60">
          {positionRows.map((row) => (
            <tr key={row.id} className={desktopRowClass}>
              <td className={cn(desktopCellClass, 'font-medium')}>
                {row.symbol}
              </td>
              <td className={desktopCellClass}>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
                    sideBadge(row.side),
                  )}
                >
                  {row.side}
                </span>
              </td>
              <td className={desktopCellClass}>
                {formatNumber(row.volume, 2)}
              </td>
              <td className={desktopCellClass}>
                {formatNumber(row.entryPrice, symbolDigitsMap[row.symbol] ?? 2)}
              </td>
              <td className={desktopCellClass}>
                {row.exitPrice != null
                  ? formatNumber(row.exitPrice, symbolDigitsMap[row.symbol] ?? 2)
                  : '--'}
              </td>
              <td
                className={cn(
                  desktopCellClass,
                  'font-semibold',
                  settledPositionPnl(row) >= 0
                    ? 'text-[var(--terminal-green)]'
                    : 'text-[var(--terminal-red)]',
                )}
              >
                {formatUsdt(settledPositionPnl(row))}
              </td>
              <td className={cn(desktopCellClass, 'text-[var(--terminal-text-secondary)]')}>
                {formatDateTime(row.openedAt)}
              </td>
              <td className={cn(desktopCellClass, 'text-[var(--terminal-text-secondary)]')}>
                {row.closedAt ? formatDateTime(row.closedAt) : '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="min-w-[1040px] w-full border-separate border-spacing-0">
      <thead className="sticky top-0 z-10 bg-[rgba(7,12,20,0.98)] backdrop-blur">
        <tr>
          {[
            'Symbol',
            'Side',
            'Volume',
            'Open Price',
            'Current',
            'P&L',
            'SL',
            'TP',
            'Close',
          ].map((label) => (
            <th key={label} className={desktopHeadCellClass}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--terminal-border)]/60">
        {positionRows.map((row) => (
          <OpenPositionDesktopRow
            key={row.id}
            row={row}
            digits={symbolDigitsMap[row.symbol] ?? 2}
            closingPositionId={closingPositionId}
            flashed={Boolean(flashedPnlIds[row.id])}
            onClosePosition={onClosePosition}
          />
        ))}
      </tbody>
    </table>
  );
}

export function TradeActivityCards({
  activeTab,
  bottomTabMeta,
  rows,
  symbolDigitsMap,
  closingPositionId,
  onClosePosition,
  mobileLimit,
}: TradeActivityCardsProps) {
  const orderRows = rows as OrderRecord[];
  const positionRows = rows as PositionRecord[];
  const visibleRows =
    typeof mobileLimit === 'number'
      ? rows.slice(0, mobileLimit)
      : rows;

  if (rows.length === 0) {
    return (
      <div className="h-full">
        <EmptyState
          title={bottomTabMeta[activeTab].emptyTitle}
          description={bottomTabMeta[activeTab].emptyDescription}
        />
      </div>
    );
  }

  if (isOrderTab(activeTab)) {
    return (
      <div className="space-y-3">
        {(visibleRows as OrderRecord[]).map((row) => (
          <div
            key={row.id}
            className="terminal-panel-soft p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--terminal-text-primary)]">{row.symbol}</p>
                <span
                  className={cn(
                    'inline-flex rounded-full px-2 py-1 text-[10px] font-semibold',
                    sideBadge(row.side),
                  )}
                >
                  {row.side}
                </span>
              </div>
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-1 text-[10px] font-semibold',
                  statusBadge(row.status),
                )}
              >
                {row.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--terminal-text-secondary)]">
              {row.type} • {formatNumber(row.volume, 2)} lots
            </p>
            <p className="mt-2 text-sm text-[var(--terminal-text-secondary)]">
              Price{' '}
              {row.executionPrice
                ? formatNumber(row.executionPrice, symbolDigitsMap[row.symbol] ?? 2)
                : row.requestedPrice
                  ? formatNumber(row.requestedPrice, symbolDigitsMap[row.symbol] ?? 2)
                  : '--'}
            </p>
            <p className="mt-2 text-sm text-[var(--terminal-text-muted)]">
              {formatDateTime(row.updatedAt)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(visibleRows as PositionRecord[]).map((row) => (
        <MobilePositionCard
          key={row.id}
          row={row}
          digits={symbolDigitsMap[row.symbol] ?? 2}
          closingPositionId={closingPositionId}
          onClosePosition={onClosePosition}
        />
      ))}
    </div>
  );
}

function OpenPositionDesktopRow({
  row,
  digits,
  closingPositionId,
  flashed,
  onClosePosition,
}: {
  row: PositionRecord;
  digits: number;
  closingPositionId: string | null;
  flashed: boolean;
  onClosePosition: (positionId: string) => void;
}) {
  const quote = useLiveQuote(row.symbol);
  const currentMark = getLivePositionMark(row, quote);
  const pnl = calculateLivePositionPnl(row, quote);

  return (
    <tr className={desktopRowClass}>
      <td className={cn(desktopCellClass, 'font-medium')}>
        {row.symbol}
      </td>
      <td className={desktopCellClass}>
        <span
          className={cn(
            'inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold',
            sideBadge(row.side),
          )}
        >
          {row.side}
        </span>
      </td>
      <td className={desktopCellClass}>
        {formatNumber(row.volume, 2)}
      </td>
      <td className={desktopCellClass}>
        {formatNumber(row.entryPrice, digits)}
      </td>
      <td className={desktopCellClass}>
        {typeof currentMark === 'number' ? formatNumber(currentMark, digits) : '--'}
      </td>
      <td
        className={cn(
          desktopCellClass,
          'font-semibold',
          pnl >= 0
            ? 'text-[var(--terminal-green)]'
            : 'text-[var(--terminal-red)]',
          flashed ? 'terminal-pnl-flash' : '',
        )}
      >
        {formatUsdt(pnl)}
      </td>
      <td className={cn(desktopCellClass, 'text-[var(--terminal-text-secondary)]')}>
        {formatTarget(row.stopLoss, digits)}
      </td>
      <td className={cn(desktopCellClass, 'text-[var(--terminal-text-secondary)]')}>
        {formatTarget(row.takeProfit, digits)}
      </td>
      <td className={desktopCellClass}>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10 text-sm font-semibold text-red-300 transition duration-150 hover:bg-red-500/20 disabled:opacity-50"
          onClick={() => onClosePosition(row.id)}
          disabled={closingPositionId === row.id}
        >
          {closingPositionId === row.id ? '...' : 'X'}
        </button>
      </td>
    </tr>
  );
}

function MobilePositionCard({
  row,
  digits,
  closingPositionId,
  onClosePosition,
}: {
  row: PositionRecord;
  digits: number;
  closingPositionId: string | null;
  onClosePosition: (positionId: string) => void;
}) {
  const quote = useLiveQuote(row.symbol);
  const currentMark = getLivePositionMark(row, quote);
  const pnl = row.status === 'OPEN'
    ? calculateLivePositionPnl(row, quote)
    : settledPositionPnl(row);
  const [flash, setFlash] = useState(false);
  const previousPnlRef = useRef<number | null>(null);

  useEffect(() => {
    const previous = previousPnlRef.current;

    if (previous != null && previous !== pnl) {
      setFlash(true);
      const timeoutId = window.setTimeout(() => setFlash(false), 220);
      previousPnlRef.current = pnl;
      return () => window.clearTimeout(timeoutId);
    }

    previousPnlRef.current = pnl;
  }, [pnl]);

  return (
    <div className={cn('terminal-panel-soft p-4', flash ? 'terminal-pnl-flash' : '')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[var(--terminal-text-primary)]">{row.symbol}</p>
          <span
            className={cn(
              'inline-flex rounded-full px-2 py-1 text-[10px] font-semibold',
              sideBadge(row.side),
            )}
          >
            {row.side}
          </span>
        </div>
        <span
          className={cn(
            'font-semibold',
            pnl >= 0
              ? 'text-[var(--terminal-green)]'
              : 'text-[var(--terminal-red)]',
          )}
        >
          {formatUsdt(pnl)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[var(--terminal-text-secondary)]">
        <span>Volume {formatNumber(row.volume, 2)}</span>
        <span>Open {formatNumber(row.entryPrice, digits)}</span>
        <span>
          {row.status === 'CLOSED' ? 'Close' : 'Current'}{' '}
          {row.status === 'CLOSED'
            ? row.exitPrice != null
              ? formatNumber(row.exitPrice, digits)
              : '--'
            : typeof currentMark === 'number'
              ? formatNumber(currentMark, digits)
              : '--'}
        </span>
        <span>{formatDateTime(row.closedAt ?? row.openedAt ?? row.updatedAt)}</span>
      </div>

      {row.status === 'OPEN' ? (
        <button
          type="button"
          className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 px-3 text-[11px] font-semibold text-red-300 transition duration-150 hover:bg-red-500/20 disabled:opacity-50"
          onClick={() => onClosePosition(row.id)}
          disabled={closingPositionId === row.id}
        >
          {closingPositionId === row.id ? 'Closing...' : 'Close Position'}
        </button>
      ) : null}
    </div>
  );
}
