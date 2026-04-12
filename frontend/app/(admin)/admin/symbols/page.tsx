'use client';

import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { formatNumber } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { AdminSymbolRecord } from '@/types/admin';

const categories = [
  'ALL',
  'FOREX',
  'CRYPTO',
  'STOCKS',
  'METALS',
  'INDICES',
  'COMMODITIES',
  'ETFS',
] as const;

type CategoryFilter = (typeof categories)[number];

export default function AdminSymbolsPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [symbols, setSymbols] = useState<AdminSymbolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const canManageSettings = hasPermission('settings.manage');

  async function refreshSymbols() {
    const records = await adminApi.getSymbols();
    setSymbols(records);
  }

  useEffect(() => {
    if (!canManageSettings) {
      return;
    }

    void (async () => {
      setLoading(true);

      try {
        await refreshSymbols();
      } finally {
        setLoading(false);
      }
    })();
  }, [canManageSettings]);

  const filteredSymbols = useMemo(() => {
    const query = search.trim().toLowerCase();

    return symbols.filter((symbol) => {
      const matchesCategory = category === 'ALL' || symbol.category === category;
      const matchesSearch =
        !query ||
        symbol.symbol.toLowerCase().includes(query) ||
        symbol.description.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [category, search, symbols]);

  function patchLocalSymbol(symbolKey: string, patch: Partial<AdminSymbolRecord>) {
    setSymbols((current) =>
      current.map((symbol) =>
        symbol.symbol === symbolKey
          ? {
              ...symbol,
              ...patch,
            }
          : symbol,
      ),
    );
  }

  async function saveSymbol(symbol: AdminSymbolRecord) {
    setSavingSymbol(symbol.symbol);

    try {
      const updated = await adminApi.updateSymbol(symbol.symbol, {
        isActive: symbol.isActive,
        maxLeverage: Number(symbol.maxLeverage),
        spreadMarkup: Number(symbol.spreadMarkup),
        tradingEnabled: symbol.tradingEnabled,
        maxExposureThreshold: Number(symbol.maxExposureThreshold),
      });

      patchLocalSymbol(symbol.symbol, updated);
      pushNotification({
        title: 'Symbol updated',
        description: `${symbol.symbol} settings saved.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Symbol update failed',
        description: error instanceof Error ? error.message : 'Save failed',
        type: 'error',
      });
    } finally {
      setSavingSymbol(null);
    }
  }

  if (!canManageSettings) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Trading Ops"
          title="Symbols"
          description="Manage instrument availability, pricing markup, and leverage controls."
        />
        <PermissionDenied
          title="Symbols unavailable"
          description="This admin account does not have permission to manage trading instruments."
          requiredPermission="settings.manage"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trading Ops"
        title="Symbols"
        description="Review live symbol status, activate or suspend instruments, and control spread/leverage overrides."
      />

      <Panel
        title="Instrument Controls"
        description="Search by symbol or description, then save per-symbol overrides."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[280px] flex-1">
              <Input
                label="Search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by symbol or description"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={
                    item === category
                      ? 'rounded-full border border-accent bg-accent px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary'
                      : 'rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-secondary'
                  }
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <DataTable
            columns={[
              {
                key: 'symbol',
                header: 'Symbol',
                render: (symbol) => (
                  <div>
                    <p className="font-medium text-primary">{symbol.symbol}</p>
                    <p className="mt-1 text-xs text-secondary">{symbol.description}</p>
                  </div>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                render: (symbol) => (
                  <div className="space-y-1">
                    <StatusBadge value={symbol.category} />
                    {symbol.marketGroup ? (
                      <p className="text-xs text-secondary">{symbol.marketGroup}</p>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'quote',
                header: 'Live Quote',
                align: 'right',
                render: (symbol) => (
                  <div className="space-y-1 text-right">
                    <p className="font-mono text-primary">
                      {symbol.lastPrice !== null
                        ? formatNumber(symbol.lastPrice, symbol.digits)
                        : '--'}
                    </p>
                    <p className="text-xs text-secondary">
                      {symbol.bid !== null && symbol.ask !== null
                        ? `${formatNumber(symbol.bid, symbol.digits)} / ${formatNumber(symbol.ask, symbol.digits)}`
                        : '--'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'margin',
                header: 'Margin %',
                align: 'right',
                render: (symbol) => formatNumber(symbol.marginRetailPct, 2),
              },
              {
                key: 'spreadMarkup',
                header: 'Spread Markup',
                render: (symbol) => (
                  <Input
                    label="Markup"
                    type="number"
                    value={symbol.spreadMarkup}
                    onChange={(event) =>
                      patchLocalSymbol(symbol.symbol, {
                        spreadMarkup: Number(event.target.value),
                      })
                    }
                  />
                ),
              },
              {
                key: 'maxLeverage',
                header: 'Max Lev',
                render: (symbol) => (
                  <Input
                    label="Leverage"
                    type="number"
                    value={symbol.maxLeverage}
                    onChange={(event) =>
                      patchLocalSymbol(symbol.symbol, {
                        maxLeverage: Number(event.target.value),
                      })
                    }
                  />
                ),
              },
              {
                key: 'threshold',
                header: 'Exposure',
                render: (symbol) => (
                  <Input
                    label="Threshold"
                    type="number"
                    value={symbol.maxExposureThreshold}
                    onChange={(event) =>
                      patchLocalSymbol(symbol.symbol, {
                        maxExposureThreshold: Number(event.target.value),
                      })
                    }
                  />
                ),
              },
              {
                key: 'status',
                header: 'Status',
                render: (symbol) => (
                  <div className="space-y-2">
                    <StatusBadge value={symbol.healthStatus} />
                    <p className="text-xs text-secondary">{symbol.marketState}</p>
                  </div>
                ),
              },
              {
                key: 'active',
                header: 'Active',
                render: (symbol) => (
                  <label className="flex items-center gap-2 text-sm text-primary">
                    <input
                      type="checkbox"
                      checked={symbol.isActive}
                      className="h-4 w-4 accent-accent"
                      onChange={(event) =>
                        patchLocalSymbol(symbol.symbol, {
                          isActive: event.target.checked,
                        })
                      }
                    />
                    <span>{symbol.isActive ? 'Enabled' : 'Disabled'}</span>
                  </label>
                ),
              },
              {
                key: 'actions',
                header: 'Actions',
                render: (symbol) => (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-primary">
                      <input
                        type="checkbox"
                        checked={symbol.tradingEnabled}
                        className="h-4 w-4 accent-accent"
                        onChange={(event) =>
                          patchLocalSymbol(symbol.symbol, {
                            tradingEnabled: event.target.checked,
                          })
                        }
                      />
                      <span>Trading enabled</span>
                    </label>
                    <Button
                      variant="secondary"
                      onClick={() => void saveSymbol(symbol)}
                      disabled={savingSymbol === symbol.symbol}
                    >
                      {savingSymbol === symbol.symbol ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                ),
              },
            ]}
            data={filteredSymbols}
            rowKey={(symbol) => symbol.symbol}
            emptyTitle={loading ? 'Loading symbols' : 'No symbols found'}
            emptyDescription={
              loading
                ? 'Fetching instruments and live quote status.'
                : 'Try adjusting the category or search filter.'
            }
          />
        </div>
      </Panel>
    </div>
  );
}
