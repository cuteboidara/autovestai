'use client';

import { FormEvent, useEffect, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { BrokerSettingsResponse, SymbolConfigRecord } from '@/types/admin';

export default function AdminSettingsPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [settings, setSettings] = useState<BrokerSettingsResponse | null>(null);
  const [symbols, setSymbols] = useState<SymbolConfigRecord[]>([]);
  const canManageSettings = hasPermission('settings.manage');

  async function refreshSettings() {
    const [settingsData, symbolData] = await Promise.all([
      adminApi.getSettings(),
      adminApi.getSymbolConfig(),
    ]);

    setSettings(settingsData);
    setSymbols(symbolData);
  }

  useEffect(() => {
    if (!canManageSettings) {
      return;
    }

    void refreshSettings();
  }, [canManageSettings]);

  if (!canManageSettings) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Settings"
          title="Broker controls"
          description="Toggle global features and adjust per-symbol risk and pricing configuration."
        />
        <PermissionDenied
          title="Settings unavailable"
          description="This admin account does not have permission to manage broker settings."
          requiredPermission="settings.manage"
        />
      </div>
    );
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settings) {
      return;
    }

    try {
      await adminApi.updateSettings({
        tradingEnabled: settings.features.tradingEnabled,
        registrationsEnabled: settings.features.registrationsEnabled,
        withdrawalsEnabled: settings.features.withdrawalsEnabled,
        copyTradingEnabled: settings.features.copyTradingEnabled,
        affiliateProgramEnabled: settings.features.affiliateProgramEnabled,
        affiliatePayoutsEnabled: settings.features.affiliatePayoutsEnabled,
        maintenanceModeEnabled: settings.features.maintenanceModeEnabled,
        maintenanceMessage: settings.features.maintenanceMessage,
        level1Percent: settings.affiliateLevels.level1Percent,
        level2Percent: settings.affiliateLevels.level2Percent,
        level3Percent: settings.affiliateLevels.level3Percent,
      });
      pushNotification({
        title: 'Settings updated',
        description: 'Broker feature settings saved.',
        type: 'success',
      });
      await refreshSettings();
    } catch (error) {
      pushNotification({
        title: 'Settings update failed',
        description: error instanceof Error ? error.message : 'Save failed',
        type: 'error',
      });
    }
  }

  async function saveSymbol(symbol: SymbolConfigRecord) {
    try {
      await adminApi.updateSymbolConfig(symbol.symbol, {
        maxLeverage: symbol.maxLeverage,
        spreadMarkup: symbol.spreadMarkup,
        tradingEnabled: symbol.tradingEnabled,
        maxExposureThreshold: symbol.maxExposureThreshold,
      });
      pushNotification({
        title: 'Symbol config updated',
        description: `${symbol.symbol} controls saved.`,
        type: 'success',
      });
      await refreshSettings();
    } catch (error) {
      pushNotification({
        title: 'Symbol config update failed',
        description: error instanceof Error ? error.message : 'Save failed',
        type: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Toggle global features and adjust per-symbol risk and pricing configuration."
      />

      <Panel title="Global Settings" description="Feature flags and affiliate level percentages.">
        {settings ? (
          <form className="space-y-4" onSubmit={saveSettings}>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <span>Global trading enabled</span>
              <input
                type="checkbox"
                checked={settings.features.tradingEnabled}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          features: {
                            ...current.features,
                            tradingEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <span>Registrations enabled</span>
              <input
                type="checkbox"
                checked={settings.features.registrationsEnabled}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          features: {
                            ...current.features,
                            registrationsEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <span>Withdrawals enabled</span>
              <input
                type="checkbox"
                checked={settings.features.withdrawalsEnabled}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          features: {
                            ...current.features,
                            withdrawalsEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <span>Copy trading enabled</span>
              <input
                type="checkbox"
                checked={settings.features.copyTradingEnabled}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          features: {
                            ...current.features,
                            copyTradingEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <span>Affiliate program enabled</span>
              <input
                type="checkbox"
                checked={settings.features.affiliateProgramEnabled}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          features: {
                            ...current.features,
                            affiliateProgramEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <span>Affiliate payouts enabled</span>
              <input
                type="checkbox"
                checked={settings.features.affiliatePayoutsEnabled}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          features: {
                            ...current.features,
                            affiliatePayoutsEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span>Maintenance mode enabled</span>
              <input
                type="checkbox"
                checked={settings.features.maintenanceModeEnabled}
                className="h-4 w-4 accent-accent"
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          features: {
                            ...current.features,
                            maintenanceModeEnabled: event.target.checked,
                          },
                        }
                      : current,
                  )
                }
              />
            </label>
            <Input
              label="Maintenance message"
              value={settings.features.maintenanceMessage}
              onChange={(event) =>
                setSettings((current) =>
                  current
                    ? {
                        ...current,
                        features: {
                          ...current.features,
                          maintenanceMessage: event.target.value,
                        },
                      }
                    : current,
                )
              }
            />
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Level 1 %"
                type="number"
                value={settings.affiliateLevels.level1Percent}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          affiliateLevels: {
                            ...current.affiliateLevels,
                            level1Percent: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
              />
              <Input
                label="Level 2 %"
                type="number"
                value={settings.affiliateLevels.level2Percent}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          affiliateLevels: {
                            ...current.affiliateLevels,
                            level2Percent: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
              />
              <Input
                label="Level 3 %"
                type="number"
                value={settings.affiliateLevels.level3Percent}
                onChange={(event) =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          affiliateLevels: {
                            ...current.affiliateLevels,
                            level3Percent: Number(event.target.value),
                          },
                        }
                      : current,
                  )
                }
              />
            </div>
            <Button type="submit">Save global settings</Button>
          </form>
        ) : (
          <p className="text-sm text-secondary">Loading settings...</p>
        )}
      </Panel>

      <Panel title="Symbol Configuration" description="Leverage, markup, trading enablement, and exposure thresholds.">
        <div className="space-y-4">
          {symbols.map((symbol) => (
            <div key={symbol.symbol} className="rounded-3xl border border-border bg-page p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-lg font-semibold text-primary">{symbol.symbol}</p>
                <label className="flex items-center gap-2 text-sm text-primary">
                  <span>Trading enabled</span>
                  <input
                    type="checkbox"
                    checked={symbol.tradingEnabled}
                    className="h-4 w-4 accent-accent"
                    onChange={(event) =>
                      setSymbols((current) =>
                        current.map((item) =>
                          item.symbol === symbol.symbol
                            ? { ...item, tradingEnabled: event.target.checked }
                            : item,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Input
                  label="Max leverage"
                  type="number"
                  value={symbol.maxLeverage}
                  onChange={(event) =>
                    setSymbols((current) =>
                      current.map((item) =>
                        item.symbol === symbol.symbol
                          ? { ...item, maxLeverage: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
                <Input
                  label="Spread markup"
                  type="number"
                  value={symbol.spreadMarkup}
                  onChange={(event) =>
                    setSymbols((current) =>
                      current.map((item) =>
                        item.symbol === symbol.symbol
                          ? { ...item, spreadMarkup: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
                <Input
                  label="Max exposure threshold"
                  type="number"
                  value={symbol.maxExposureThreshold}
                  onChange={(event) =>
                    setSymbols((current) =>
                      current.map((item) =>
                        item.symbol === symbol.symbol
                          ? { ...item, maxExposureThreshold: Number(event.target.value) }
                          : item,
                      ),
                    )
                  }
                />
              </div>
              <div className="mt-4">
                <Button variant="secondary" onClick={() => void saveSymbol(symbol)}>
                  Save {symbol.symbol}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
