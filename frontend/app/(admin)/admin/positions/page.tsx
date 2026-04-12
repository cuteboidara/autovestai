'use client';

import { useEffect, useState } from 'react';

import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime, formatNumber, formatUsdt } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { AdminOpenPosition } from '@/types/admin';

export default function AdminPositionsPage() {
  const pushNotification = useNotificationStore((state) => state.push);
  const [positions, setPositions] = useState<AdminOpenPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void adminApi
      .listOpenPositions()
      .then((response) => {
        if (active) {
          setPositions(response);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load live positions',
          description: error instanceof Error ? error.message : 'Request failed',
          type: 'error',
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [pushNotification]);

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-border bg-surface p-6 shadow-shell">
        <p className="label-eyebrow">Trading</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary">Live Positions</h1>
        <p className="mt-3 max-w-3xl text-sm text-secondary">
          Open positions across all client accounts, including copied trades and suspended-account exposure.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-page">
              <tr className="text-left text-xs uppercase tracking-[0.14em] text-secondary">
                {['Client', 'Account', 'Symbol', 'Side', 'Volume', 'Entry', 'P&L', 'Opened', 'Status'].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-secondary">
                    Loading live positions...
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-secondary">
                    No open positions were found.
                  </td>
                </tr>
              ) : (
                positions.map((position) => (
                  <tr key={position.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{position.email}</p>
                      <p className="mt-1 text-xs text-secondary">{position.userId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{position.accountName}</p>
                      <p className="mt-1 text-xs text-secondary">
                        {position.accountNo} • {position.accountType}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">{position.symbol}</td>
                    <td className="px-4 py-3">{position.side}</td>
                    <td className="px-4 py-3">{formatNumber(position.volume, 2)}</td>
                    <td className="px-4 py-3">{formatNumber(position.entryPrice, 5)}</td>
                    <td className="px-4 py-3">{formatUsdt(position.pnl)}</td>
                    <td className="px-4 py-3">{formatDateTime(position.openedAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={position.accountStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
