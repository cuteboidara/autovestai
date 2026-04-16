'use client';

import { motion } from 'framer-motion';
import { ChevronUp, ListPlus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

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

interface TradeActivityPanelProps {
  activeTab: TradeBottomTab;
  bottomTabMeta: Record<TradeBottomTab, TradeBottomTabMeta>;
  rows: Array<PositionRecord | OrderRecord>;
  symbolDigitsMap: Record<string, number>;
  positionsHeight: number;
  closingPositionId: string | null;
  flashedPnlIds: Record<string, true>;
  mobileExpanded: boolean;
  onSetTab: (tab: TradeBottomTab) => void;
  onClosePosition: (positionId: string) => void;
  onResizeStart: (clientY: number) => void;
  onMobileExpandedChange: (expanded: boolean) => void;
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
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
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

export function TradeActivityPanel({
  activeTab,
  bottomTabMeta,
  rows,
  symbolDigitsMap,
  positionsHeight,
  closingPositionId,
  flashedPnlIds,
  mobileExpanded,
  onSetTab,
  onClosePosition,
  onResizeStart,
  onMobileExpandedChange,
}: TradeActivityPanelProps) {
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const isOrderTab = activeTab === 'pending' || activeTab === 'history';
  const isClosedPositionsTab = activeTab === 'closed';
  const positionRows = rows as PositionRecord[];
  const orderRows = rows as OrderRecord[];
  const desktopPanelId = useId();

  const renderDesktopTable = () => {
    if (rows.length === 0) {
      return (
        <EmptyState
          title={bottomTabMeta[activeTab].emptyTitle}
          description={bottomTabMeta[activeTab].emptyDescription}
        />
      );
    }

    if (isOrderTab) {
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

    if (isClosedPositionsTab) {
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
  };

  const renderMobileCards = () => {
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

    if (isOrderTab) {
      return (
        <div className="space-y-3">
          {orderRows.slice(0, 12).map((row) => (
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
        {positionRows.slice(0, 12).map((row) => {
          return (
            <MobilePositionCard
              key={row.id}
              row={row}
              digits={symbolDigitsMap[row.symbol] ?? 2}
              closingPositionId={closingPositionId}
              onClosePosition={onClosePosition}
            />
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className="hidden md:block">
        <div className="flex justify-center py-1.5">
          <button
            type="button"
            aria-controls={desktopPanelId}
            aria-expanded={isActivityOpen}
            aria-label={isActivityOpen ? 'Collapse activity panel' : 'Expand activity panel'}
            className="inline-flex h-7 w-12 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[rgba(9,16,26,0.92)] text-[var(--terminal-text-secondary)] transition duration-200 hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]"
            onClick={() => setIsActivityOpen((open) => !open)}
          >
            <ChevronUp
              className={cn(
                'h-4 w-4 transition-transform duration-300',
                isActivityOpen ? '' : 'rotate-180',
              )}
            />
          </button>
        </div>

        <div
          id={desktopPanelId}
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{ maxHeight: isActivityOpen ? `${positionsHeight}px` : '0px' }}
        >
          <div
            className="terminal-panel overflow-hidden"
            style={{ height: positionsHeight }}
          >
            <button
              type="button"
              className="flex h-3 w-full cursor-row-resize items-center justify-center border-b border-[var(--terminal-border)] bg-[rgba(9,16,26,0.9)]"
              onMouseDown={(event) => onResizeStart(event.clientY)}
            >
              <span className="h-px w-12 bg-[var(--terminal-text-muted)]" />
            </button>

            <div className="flex h-[calc(100%-12px)] min-h-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--terminal-border)] px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                  {(Object.entries(bottomTabMeta) as Array<[TradeBottomTab, TradeBottomTabMeta]>).map(
                    ([value, meta]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => onSetTab(value)}
                        className={cn(
                          'inline-flex h-7 items-center rounded-md border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition duration-150',
                          activeTab === value
                            ? 'border-[var(--terminal-border-strong)] bg-[rgba(128,148,184,0.14)] text-[var(--terminal-text-primary)]'
                            : 'border-[var(--terminal-border)] bg-[rgba(9,16,26,0.88)] text-[var(--terminal-text-secondary)] hover:bg-[var(--terminal-bg-hover)] hover:text-[var(--terminal-text-primary)]',
                        )}
                      >
                        {meta.label}
                      </button>
                    ),
                  )}
                </div>
                <span className="text-[11px] text-[var(--terminal-text-secondary)]">
                  {rows.length} {rows.length === 1 ? 'row' : 'rows'}
                </span>
              </div>

              <div className="terminal-scrollbar min-h-0 flex-1 overflow-auto">
                {renderDesktopTable()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={(_, info) => {
          if (info.offset.y < -30) {
            onMobileExpandedChange(true);
          } else if (info.offset.y > 30) {
            onMobileExpandedChange(false);
          }
        }}
        animate={{ height: mobileExpanded ? '60vh' : 88 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="fixed inset-x-0 bottom-0 z-20 overflow-hidden rounded-t-[12px] border-t border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] shadow-[0_-20px_50px_rgba(2,6,23,0.45)] md:hidden"
      >
        <button
          type="button"
          className="flex w-full flex-col items-center border-b border-[var(--terminal-border)] px-4 py-3"
          onClick={() => onMobileExpandedChange(!mobileExpanded)}
        >
          <span className="h-[3px] w-12 rounded-full bg-[var(--terminal-text-muted)]" />
          <div className="mt-3 flex w-full items-center justify-between">
            <p className="text-sm font-semibold text-[var(--terminal-text-primary)]">
              {bottomTabMeta[activeTab].label}
            </p>
            <ChevronUp
              className={cn(
                'h-4 w-4 text-[var(--terminal-text-secondary)] transition-transform',
                mobileExpanded ? 'rotate-180' : '',
              )}
            />
          </div>
        </button>

        <div className="border-b border-[var(--terminal-border)] px-3 py-2">
          <div className="terminal-scrollbar flex items-center gap-2 overflow-x-auto">
            {(Object.entries(bottomTabMeta) as Array<[TradeBottomTab, TradeBottomTabMeta]>).map(
              ([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSetTab(value)}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[11px] font-semibold transition duration-150',
                    activeTab === value
                      ? 'border-[var(--terminal-accent)] bg-[var(--terminal-accent)] text-[#0A0E1A]'
                      : 'border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] text-[var(--terminal-text-secondary)]',
                  )}
                >
                  {meta.shortLabel}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="terminal-scrollbar h-full overflow-y-auto px-3 py-3 pb-24">
          {renderMobileCards()}
        </div>
      </motion.div>
    </>
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
