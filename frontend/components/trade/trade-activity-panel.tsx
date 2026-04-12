'use client';

import { motion } from 'framer-motion';
import { ChevronUp, ListPlus } from 'lucide-react';

import { cn, formatDateTime, formatNumber, formatUsdt } from '@/lib/utils';
import { MarketQuote } from '@/types/market-data';
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
  quotes: Record<string, MarketQuote>;
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

function currentPositionMark(position: PositionRecord, quote?: MarketQuote) {
  if (typeof position.currentPrice === 'number' && position.currentPrice > 0) {
    return position.currentPrice;
  }

  if (!quote) {
    return null;
  }

  return position.side === 'BUY' ? quote.bid : quote.ask;
}

function positionPnl(position: PositionRecord) {
  return position.unrealizedPnl ?? position.pnl;
}

function formatTarget(
  value: number | null | undefined,
  digits: number,
) {
  return typeof value === 'number' ? formatNumber(value, digits) : '--';
}

function sideBadge(side: 'BUY' | 'SELL') {
  return side === 'BUY'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    : 'border-red-500/25 bg-red-500/10 text-red-300';
}

function statusBadge(status: OrderRecord['status']) {
  switch (status) {
    case 'EXECUTED':
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300';
    case 'PENDING':
    case 'OPEN':
    case 'PROCESSING':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-300';
    default:
      return 'border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] text-[var(--terminal-text-secondary)]';
  }
}

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
      <div className="flex h-12 w-12 items-center justify-center border border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] text-[var(--terminal-text-secondary)]">
        <ListPlus className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--terminal-text-primary)]">{title}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
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
  quotes,
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
  const isOrderTab = activeTab === 'pending' || activeTab === 'history';
  const isClosedPositionsTab = activeTab === 'closed';
  const positionRows = rows as PositionRecord[];
  const orderRows = rows as OrderRecord[];

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
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--terminal-bg-surface)]">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
              {['Symbol', 'Side', 'Type', 'Volume', 'Price', 'Status', 'Updated'].map((label) => (
                <th key={label} className="border-b border-[var(--terminal-border)] px-3 py-3 text-left">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderRows.map((row) => (
              <tr
                key={row.id}
                className="text-[13px] text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)]"
              >
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 font-medium">
                  {row.symbol}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      sideBadge(row.side),
                    )}
                  >
                    {row.side}
                  </span>
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 text-[var(--terminal-text-secondary)]">
                  {row.type}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {formatNumber(row.volume, 2)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {row.executionPrice
                    ? formatNumber(row.executionPrice, symbolDigitsMap[row.symbol] ?? 2)
                    : row.requestedPrice
                      ? formatNumber(row.requestedPrice, symbolDigitsMap[row.symbol] ?? 2)
                      : '--'}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      statusBadge(row.status),
                    )}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 text-[var(--terminal-text-secondary)]">
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
        <table className="min-w-full border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 bg-[var(--terminal-bg-surface)]">
            <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
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
                <th key={label} className="border-b border-[var(--terminal-border)] px-3 py-3 text-left">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positionRows.map((row) => (
              <tr
                key={row.id}
                className="text-[13px] text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)]"
              >
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 font-medium">
                  {row.symbol}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      sideBadge(row.side),
                    )}
                  >
                    {row.side}
                  </span>
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {formatNumber(row.volume, 2)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {formatNumber(row.entryPrice, symbolDigitsMap[row.symbol] ?? 2)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {row.exitPrice != null
                    ? formatNumber(row.exitPrice, symbolDigitsMap[row.symbol] ?? 2)
                    : '--'}
                </td>
                <td
                  className={cn(
                    'border-b border-[var(--terminal-border)] px-3 py-3 font-semibold',
                    positionPnl(row) >= 0
                      ? 'text-[var(--terminal-green)]'
                      : 'text-[var(--terminal-red)]',
                  )}
                >
                  {formatUsdt(positionPnl(row))}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 text-[var(--terminal-text-secondary)]">
                  {formatDateTime(row.openedAt)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 text-[var(--terminal-text-secondary)]">
                  {row.closedAt ? formatDateTime(row.closedAt) : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-[var(--terminal-bg-surface)]">
          <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--terminal-text-secondary)]">
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
              <th key={label} className="border-b border-[var(--terminal-border)] px-3 py-3 text-left">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positionRows.map((row) => {
            const digits = symbolDigitsMap[row.symbol] ?? 2;
            const currentMark = currentPositionMark(row, quotes[row.symbol]);

            return (
              <tr
                key={row.id}
                className="text-[13px] text-[var(--terminal-text-primary)] transition duration-150 hover:bg-[var(--terminal-bg-hover)]"
              >
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 font-medium">
                  {row.symbol}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      sideBadge(row.side),
                    )}
                  >
                    {row.side}
                  </span>
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {formatNumber(row.volume, 2)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {formatNumber(row.entryPrice, digits)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  {typeof currentMark === 'number' ? formatNumber(currentMark, digits) : '--'}
                </td>
                <td
                  className={cn(
                    'border-b border-[var(--terminal-border)] px-3 py-3 font-semibold',
                    positionPnl(row) >= 0
                      ? 'text-[var(--terminal-green)]'
                      : 'text-[var(--terminal-red)]',
                    flashedPnlIds[row.id] ? 'terminal-pnl-flash' : '',
                  )}
                >
                  {formatUsdt(positionPnl(row))}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 text-[var(--terminal-text-secondary)]">
                  {formatTarget(row.stopLoss, digits)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3 text-[var(--terminal-text-secondary)]">
                  {formatTarget(row.takeProfit, digits)}
                </td>
                <td className="border-b border-[var(--terminal-border)] px-3 py-3">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center border border-red-500/25 bg-red-500/10 text-sm font-semibold text-red-300 transition duration-150 hover:bg-red-500/20 disabled:opacity-50"
                    onClick={() => onClosePosition(row.id)}
                    disabled={closingPositionId === row.id}
                  >
                    {closingPositionId === row.id ? '...' : 'X'}
                  </button>
                </td>
              </tr>
            );
          })}
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
              className="border border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[var(--terminal-text-primary)]">{row.symbol}</p>
                  <span
                    className={cn(
                      'inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      sideBadge(row.side),
                    )}
                  >
                    {row.side}
                  </span>
                </div>
                <span
                  className={cn(
                    'inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
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
          const digits = symbolDigitsMap[row.symbol] ?? 2;
          const currentMark = currentPositionMark(row, quotes[row.symbol]);

          return (
            <div
              key={row.id}
              className="border border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-[var(--terminal-text-primary)]">{row.symbol}</p>
                  <span
                    className={cn(
                      'inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                      sideBadge(row.side),
                    )}
                  >
                    {row.side}
                  </span>
                </div>
                <span
                  className={cn(
                    'font-semibold',
                    positionPnl(row) >= 0
                      ? 'text-[var(--terminal-green)]'
                      : 'text-[var(--terminal-red)]',
                  )}
                >
                  {formatUsdt(positionPnl(row))}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[var(--terminal-text-secondary)]">
                <span>Volume {formatNumber(row.volume, 2)}</span>
                <span>Open {formatNumber(row.entryPrice, digits)}</span>
                <span>
                  {activeTab === 'closed' ? 'Close' : 'Current'}{' '}
                  {activeTab === 'closed'
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
                  className="mt-3 inline-flex h-9 items-center justify-center border border-red-500/25 bg-red-500/10 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-300 transition duration-150 hover:bg-red-500/20 disabled:opacity-50"
                  onClick={() => onClosePosition(row.id)}
                  disabled={closingPositionId === row.id}
                >
                  {closingPositionId === row.id ? 'Closing...' : 'Close Position'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div
        className="hidden border-t border-[var(--terminal-border)] bg-[var(--terminal-bg-primary)] md:block"
        style={{ height: positionsHeight }}
      >
        <button
          type="button"
          className="flex h-4 w-full cursor-row-resize items-center justify-center border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)]"
          onMouseDown={(event) => onResizeStart(event.clientY)}
        >
          <span className="h-[2px] w-16 bg-[var(--terminal-text-muted)]" />
        </button>

        <div className="flex h-[calc(100%-16px)] min-h-0 flex-col">
          <div className="flex items-center gap-5 border-b border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] px-4 py-3">
            {(Object.entries(bottomTabMeta) as Array<[TradeBottomTab, TradeBottomTabMeta]>).map(
              ([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onSetTab(value)}
                  className={cn(
                    'border-b-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition duration-150',
                    activeTab === value
                      ? 'border-[var(--terminal-accent)] text-[var(--terminal-text-primary)]'
                      : 'border-transparent text-[var(--terminal-text-secondary)] hover:text-[var(--terminal-text-primary)]',
                  )}
                >
                  {meta.label}
                </button>
              ),
            )}
          </div>

          <div className="terminal-scrollbar min-h-0 flex-1 overflow-auto">
            {renderDesktopTable()}
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
        className="fixed inset-x-0 bottom-0 z-20 overflow-hidden rounded-t-md border-t border-[var(--terminal-border)] bg-[var(--terminal-bg-surface)] md:hidden"
      >
        <button
          type="button"
          className="flex w-full flex-col items-center border-b border-[var(--terminal-border)] px-4 py-3"
          onClick={() => onMobileExpandedChange(!mobileExpanded)}
        >
          <span className="h-[2px] w-14 bg-[var(--terminal-text-muted)]" />
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
                    'inline-flex h-8 shrink-0 items-center border px-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition duration-150',
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
