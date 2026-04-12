'use client';

import { useEffect, useState } from 'react';

import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime, formatNumber } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { AdminOrderRecord } from '@/types/admin';

export default function AdminOrdersPage() {
  const pushNotification = useNotificationStore((state) => state.push);
  const [orders, setOrders] = useState<AdminOrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void adminApi
      .listOrders()
      .then((response) => {
        if (active) {
          setOrders(response);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load orders',
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
        <h1 className="mt-2 text-3xl font-semibold text-primary">All Orders</h1>
        <p className="mt-3 max-w-3xl text-sm text-secondary">
          Order blotter across all client accounts, including executed, rejected, and pending orders.
        </p>
      </header>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-page">
              <tr className="text-left text-xs uppercase tracking-[0.14em] text-secondary">
                {['Client', 'Account', 'Symbol', 'Side', 'Type', 'Status', 'Volume', 'Requested', 'Executed', 'Created'].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-secondary">
                    Loading order blotter...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-secondary">
                    No orders were found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{order.email}</p>
                      <p className="mt-1 text-xs text-secondary">{order.userId}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-primary">{order.accountName}</p>
                      <p className="mt-1 text-xs text-secondary">
                        {order.accountNo} • {order.accountType}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-primary">{order.symbol}</td>
                    <td className="px-4 py-3">{order.side}</td>
                    <td className="px-4 py-3">{order.type}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={order.status} />
                    </td>
                    <td className="px-4 py-3">{formatNumber(order.volume, 2)}</td>
                    <td className="px-4 py-3">
                      {order.requestedPrice === null ? '--' : formatNumber(order.requestedPrice, 5)}
                    </td>
                    <td className="px-4 py-3">
                      {order.executionPrice === null ? '--' : formatNumber(order.executionPrice, 5)}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(order.createdAt)}</td>
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
