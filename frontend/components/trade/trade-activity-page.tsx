'use client';

import Link from 'next/link';
import { LineChart, Receipt, SquareTerminal } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import {
  TRADE_ACTIVITY_META,
  TradeActivityCards,
  TradeActivityTable,
  type TradeBottomTab,
} from '@/components/trade/trade-activity-content';
import { Button } from '@/components/ui/button';
import { useAccountContext } from '@/context/account-context';
import { useLivePriceSubscription } from '@/hooks/use-live-prices';
import { calculateLivePositionPnl } from '@/lib/trade-live-metrics';
import { cn, formatNumber, formatUsdt } from '@/lib/utils';
import { marketDataApi } from '@/services/api/market-data';
import { ordersApi } from '@/services/api/orders';
import { positionsApi } from '@/services/api/positions';
import { useMarketDataStore } from '@/store/market-data-store';
import { useNotificationStore } from '@/store/notification-store';
import { useOrdersStore } from '@/store/orders-store';
import { usePositionsStore } from '@/store/positions-store';
import { SymbolInfo } from '@/types/market-data';

type ActivityPageKind = 'orders' | 'positions';

const activityPageConfig = {
  orders: {
    route: '/orders',
    eyebrow: 'Client Portal / Orders',
    title: 'Orders',
    description: 'Track pending order flow and completed routing without opening the terminal activity drawer.',
    allowedTabs: ['pending', 'history'] as TradeBottomTab[],
    defaultTab: 'pending' as TradeBottomTab,
    secondaryHref: '/positions',
    secondaryLabel: 'View Positions',
    secondaryIcon: <LineChart className="h-4 w-4" />,
  },
  positions: {
    route: '/positions',
    eyebrow: 'Client Portal / Positions',
    title: 'Positions',
    description: 'Monitor live exposure and closed trades on a dedicated page while keeping the terminal focused on charting and order entry.',
    allowedTabs: ['open', 'closed'] as TradeBottomTab[],
    defaultTab: 'open' as TradeBottomTab,
    secondaryHref: '/orders',
    secondaryLabel: 'View Orders',
    secondaryIcon: <Receipt className="h-4 w-4" />,
  },
} as const;

function dateValue(value?: string | null) {
  return value ? new Date(value).getTime() : 0;
}

function positionPnlSignatureValue(value: number) {
  return Number.isFinite(value) ? value.toFixed(8) : '0.00000000';
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-glow">
      <p className="label-eyebrow">{label}</p>
      <p className={cn('mt-3 text-2xl font-semibold text-primary', tone)}>{value}</p>
      <p className="mt-2 text-sm text-secondary">{hint}</p>
    </div>
  );
}

function ActivityLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-border bg-surface p-5 shadow-glow">
            <div className="h-3 w-28 animate-pulse rounded bg-page" />
            <div className="mt-4 h-8 w-32 animate-pulse rounded bg-page" />
            <div className="mt-3 h-4 w-40 animate-pulse rounded bg-page" />
          </div>
        ))}
      </div>
      <div className="rounded-3xl border border-border bg-surface shadow-glow">
        <div className="border-b border-border px-5 py-5">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-9 w-28 animate-pulse rounded-md bg-page" />
            ))}
          </div>
        </div>
        <div className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-xl bg-page" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TradeActivityPage({ kind }: { kind: ActivityPageKind }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pushNotification = useNotificationStore((state) => state.push);
  const upsertQuote = useMarketDataStore((state) => state.upsertQuote);
  const quotes = useMarketDataStore((state) => state.quotes);
  const orders = useOrdersStore((state) => state.orders);
  const setOrders = useOrdersStore((state) => state.setOrders);
  const positions = usePositionsStore((state) => state.positions);
  const setPositions = usePositionsStore((state) => state.setPositions);
  const { activeAccount, activeAccountId } = useAccountContext();
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingPositionId, setClosingPositionId] = useState<string | null>(null);
  const [flashedPnlIds, setFlashedPnlIds] = useState<Record<string, true>>({});
  const previousPnlRef = useRef<Record<string, number>>({});

  const config = activityPageConfig[kind];
  const activeTab = config.allowedTabs.includes(searchParams.get('tab') as TradeBottomTab)
    ? (searchParams.get('tab') as TradeBottomTab)
    : config.defaultTab;
  const accountQuery = activeAccountId
    ? `accountId=${encodeURIComponent(activeAccountId)}`
    : undefined;

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);

      try {
        const [symbolsResult, activityResult] = await Promise.allSettled([
          marketDataApi.listSymbols({ enabledOnly: true }),
          kind === 'orders'
            ? ordersApi.list(accountQuery)
            : positionsApi.list(activeAccountId, 'ALL'),
        ]);

        if (!active) {
          return;
        }

        if (symbolsResult.status === 'fulfilled') {
          setSymbols(symbolsResult.value);
        } else {
          setSymbols([]);
        }

        if (activityResult.status === 'rejected') {
          throw activityResult.reason;
        }

        if (kind === 'orders') {
          setOrders(activityResult.value as Awaited<ReturnType<typeof ordersApi.list>>);
          return;
        }

        const nextPositions = activityResult.value as Awaited<ReturnType<typeof positionsApi.list>>;
        setPositions(nextPositions);

        const openSymbols = [...new Set(
          nextPositions
            .filter((position) => position.status === 'OPEN')
            .map((position) => position.symbol),
        )];

        if (openSymbols.length === 0) {
          return;
        }

        const quoteResults = await Promise.allSettled(
          openSymbols.map((symbol) => marketDataApi.getPrice(symbol)),
        );

        if (!active) {
          return;
        }

        quoteResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            upsertQuote(result.value);
          }
        });
      } catch (error) {
        if (active) {
          pushNotification({
            title: `${config.title} unavailable`,
            description: error instanceof Error ? error.message : 'Request failed.',
            type: 'error',
          });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [accountQuery, activeAccountId, config.title, kind, pushNotification, setOrders, setPositions, upsertQuote]);

  const symbolDigitsMap = useMemo(
    () => Object.fromEntries(symbols.map((symbol) => [symbol.symbol, symbol.digits])),
    [symbols],
  );
  const openPositions = useMemo(
    () =>
      positions
        .filter((position) =>
          position.status === 'OPEN' &&
          (!activeAccountId || position.accountId === activeAccountId),
        )
        .sort(
          (left, right) =>
            dateValue(right.openedAt ?? right.updatedAt) -
            dateValue(left.openedAt ?? left.updatedAt),
        ),
    [activeAccountId, positions],
  );
  const closedPositions = useMemo(
    () =>
      positions
        .filter((position) =>
          position.status === 'CLOSED' &&
          (!activeAccountId || position.accountId === activeAccountId),
        )
        .sort(
          (left, right) =>
            dateValue(right.closedAt ?? right.updatedAt) -
            dateValue(left.closedAt ?? left.updatedAt),
        ),
    [activeAccountId, positions],
  );
  const pendingOrders = useMemo(
    () =>
      orders
        .filter((order) =>
          ['PENDING', 'OPEN', 'PROCESSING'].includes(order.status) &&
          (!activeAccountId || order.accountId === activeAccountId),
        )
        .sort((left, right) => dateValue(right.updatedAt) - dateValue(left.updatedAt)),
    [activeAccountId, orders],
  );
  const orderHistory = useMemo(
    () =>
      orders
        .filter((order) =>
          ['EXECUTED', 'REJECTED', 'CANCELLED'].includes(order.status) &&
          (!activeAccountId || order.accountId === activeAccountId),
        )
        .sort((left, right) => dateValue(right.updatedAt) - dateValue(left.updatedAt)),
    [activeAccountId, orders],
  );
  const liveSubscriptionSymbols = useMemo(
    () => [...new Set(openPositions.map((position) => position.symbol))],
    [openPositions],
  );

  useLivePriceSubscription(kind === 'positions' ? liveSubscriptionSymbols : []);

  const liveFloatingPnl = useMemo(
    () =>
      openPositions.reduce(
        (total, position) => total + calculateLivePositionPnl(position, quotes[position.symbol]),
        0,
      ),
    [openPositions, quotes],
  );
  const liveOpenPositionPnlSignature = useMemo(
    () =>
      openPositions
        .map(
          (position) =>
            `${position.id}:${positionPnlSignatureValue(
              calculateLivePositionPnl(position, quotes[position.symbol]),
            )}`,
        )
        .join('|'),
    [openPositions, quotes],
  );

  useEffect(() => {
    if (kind !== 'positions' || !liveOpenPositionPnlSignature) {
      return;
    }

    const nextFlashes: Record<string, true> = {};

    for (const entry of liveOpenPositionPnlSignature.split('|')) {
      if (!entry) {
        continue;
      }

      const separatorIndex = entry.indexOf(':');

      if (separatorIndex === -1) {
        continue;
      }

      const positionId = entry.slice(0, separatorIndex);
      const nextPnl = Number(entry.slice(separatorIndex + 1));
      const previous = previousPnlRef.current[positionId];

      if (typeof previous === 'number' && previous !== nextPnl) {
        nextFlashes[positionId] = true;
      }

      previousPnlRef.current[positionId] = nextPnl;
    }

    if (Object.keys(nextFlashes).length === 0) {
      return;
    }

    setFlashedPnlIds((current) => ({ ...current, ...nextFlashes }));
    const timeoutId = window.setTimeout(() => {
      setFlashedPnlIds((current) => {
        const next = { ...current };

        for (const positionId of Object.keys(nextFlashes)) {
          delete next[positionId];
        }

        return next;
      });
    }, 420);

    return () => window.clearTimeout(timeoutId);
  }, [kind, liveOpenPositionPnlSignature]);

  const rows =
    kind === 'orders'
      ? activeTab === 'history'
        ? orderHistory
        : pendingOrders
      : activeTab === 'closed'
        ? closedPositions
        : openPositions;

  async function handleClosePosition(positionId: string) {
    setClosingPositionId(positionId);

    try {
      await positionsApi.close(positionId);
      const nextPositions = await positionsApi.list(activeAccountId, 'ALL');
      setPositions(nextPositions);
    } catch (error) {
      pushNotification({
        title: 'Unable to close position',
        description: error instanceof Error ? error.message : 'Request failed.',
        type: 'error',
      });
    } finally {
      setClosingPositionId(null);
    }
  }

  function handleSetTab(nextTab: TradeBottomTab) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextTab === config.defaultTab) {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }

    const query = params.toString();
    router.replace(query ? `${config.route}?${query}` : config.route);
  }

  const summaryCards =
    kind === 'orders'
      ? [
          {
            label: 'Pending Orders',
            value: formatNumber(pendingOrders.length, 0),
            hint: 'Awaiting execution or confirmation.',
          },
          {
            label: 'Order History',
            value: formatNumber(orderHistory.length, 0),
            hint: 'Executed, rejected, and cancelled orders.',
          },
          {
            label: 'Active Account',
            value: activeAccount?.accountNo ?? 'All Accounts',
            hint: activeAccount ? `${activeAccount.type} account scope.` : 'Showing all available account activity.',
          },
        ]
      : [
          {
            label: 'Open Positions',
            value: formatNumber(openPositions.length, 0),
            hint: 'Live market exposure on the active account.',
          },
          {
            label: 'Closed Positions',
            value: formatNumber(closedPositions.length, 0),
            hint: 'Settled positions with realized results.',
          },
          {
            label: 'Floating PnL',
            value: formatUsdt(liveFloatingPnl),
            hint: 'Marked to live prices across open positions.',
            tone:
              liveFloatingPnl >= 0
                ? 'text-[var(--terminal-green)]'
                : 'text-[var(--terminal-red)]',
          },
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        description={config.description}
        actions={(
          <>
            <Button asChild variant="secondary">
              <Link href={config.secondaryHref}>
                {config.secondaryIcon}
                {config.secondaryLabel}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/trade">
                <SquareTerminal className="h-4 w-4" />
                Open Terminal
              </Link>
            </Button>
          </>
        )}
      />

      {loading ? <ActivityLoadingSkeleton /> : (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            {summaryCards.map((card) => (
              <SummaryCard
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
                tone={card.tone}
              />
            ))}
          </div>

          <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-glow">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-5 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {config.allowedTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleSetTab(tab)}
                    className={cn(
                      'inline-flex h-10 items-center rounded-md border px-4 text-sm font-semibold transition duration-150',
                      activeTab === tab
                        ? 'border-accent/40 bg-accent/10 text-primary'
                        : 'border-border bg-page text-secondary hover:bg-page/80 hover:text-primary',
                    )}
                  >
                    {TRADE_ACTIVITY_META[tab].label}
                  </button>
                ))}
              </div>
              <div className="text-sm text-secondary">
                {rows.length} {rows.length === 1 ? 'row' : 'rows'} • {activeAccount?.accountNo ?? 'All accounts'}
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <TradeActivityTable
                activeTab={activeTab}
                bottomTabMeta={TRADE_ACTIVITY_META}
                rows={rows}
                symbolDigitsMap={symbolDigitsMap}
                closingPositionId={closingPositionId}
                flashedPnlIds={flashedPnlIds}
                onClosePosition={handleClosePosition}
              />
            </div>

            <div className="p-4 md:hidden">
              <TradeActivityCards
                activeTab={activeTab}
                bottomTabMeta={TRADE_ACTIVITY_META}
                rows={rows}
                symbolDigitsMap={symbolDigitsMap}
                closingPositionId={closingPositionId}
                flashedPnlIds={flashedPnlIds}
                onClosePosition={handleClosePosition}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
