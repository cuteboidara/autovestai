'use client';

import { motion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';

import {
  TradeActivityCards,
  TradeActivityTable,
  type TradeBottomTab,
  type TradeBottomTabMeta,
} from '@/components/trade/trade-activity-content';
import { cn } from '@/lib/utils';
import { OrderRecord, PositionRecord } from '@/types/trading';

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
  const desktopPanelId = useId();

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
                <TradeActivityTable
                  activeTab={activeTab}
                  bottomTabMeta={bottomTabMeta}
                  rows={rows}
                  symbolDigitsMap={symbolDigitsMap}
                  closingPositionId={closingPositionId}
                  flashedPnlIds={flashedPnlIds}
                  onClosePosition={onClosePosition}
                />
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
          <TradeActivityCards
            activeTab={activeTab}
            bottomTabMeta={bottomTabMeta}
            rows={rows}
            symbolDigitsMap={symbolDigitsMap}
            closingPositionId={closingPositionId}
            flashedPnlIds={flashedPnlIds}
            onClosePosition={onClosePosition}
            mobileLimit={12}
          />
        </div>
      </motion.div>
    </>
  );
}
