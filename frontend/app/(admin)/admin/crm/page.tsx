'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { useAuth } from '@/hooks/use-auth';
import { StatusBadge } from '@/components/ui/status-badge';
import { adminRoute } from '@/lib/admin-route';
import { formatDateTime, formatUsdt } from '@/lib/utils';
import { crmApi } from '@/services/api/crm';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { CrmClientListItem } from '@/types/crm';

export default function CrmClientListPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [clients, setClients] = useState<CrmClientListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [country, setCountry] = useState('');
  const [registeredFrom, setRegisteredFrom] = useState('');
  const [registeredTo, setRegisteredTo] = useState('');
  const [loading, setLoading] = useState(true);
  const canReadCrm = hasPermission('crm.read');
  const canAddNotes = hasPermission('crm.notes');
  const canSendEmail = hasPermission('email.send');
  const canManageUsers = hasPermission('users.manage');

  const query = useMemo(
    () => ({
      search,
      kycStatus,
      country,
      registeredFrom,
      registeredTo,
      sortBy: 'registration_date',
      sortOrder: 'desc',
      limit: 100,
    }),
    [country, kycStatus, registeredFrom, registeredTo, search],
  );

  useEffect(() => {
    if (!canReadCrm) {
      return;
    }

    let active = true;

    setLoading(true);
    void crmApi
      .listClients(query)
      .then((response) => {
        if (active) {
          setClients(response.items);
        }
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load CRM clients',
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
  }, [canReadCrm, pushNotification, query]);

  if (!canReadCrm) {
    return (
      <section className="space-y-6">
        <header className="rounded-3xl border border-border bg-surface p-6 shadow-shell">
          <p className="label-eyebrow">Client Management</p>
          <h1 className="mt-2 text-3xl font-semibold text-primary">CRM / Clients</h1>
          <p className="mt-3 max-w-3xl text-sm text-secondary">
            Search client records by account number, email, or identity profile, then jump directly into compliance, balances, trading, notes, and email history.
          </p>
        </header>
        <PermissionDenied
          title="CRM unavailable"
          description="This admin account does not have permission to access client CRM records."
          requiredPermission="crm.read"
        />
      </section>
    );
  }

  const selectedClients = clients.filter((client) => selectedIds.includes(client.id));

  function toggleSelected(clientId: string) {
    setSelectedIds((current) =>
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId],
    );
  }

  function exportCsv() {
    const header = [
      'Account No',
      'Full Name',
      'Email',
      'Phone',
      'Country',
      'KYC Status',
      'Balance',
      'Accounts',
      'Registered',
      'Last Login',
    ];
    const rows = clients.map((client) => [
      client.accountNumber,
      client.fullName ?? '',
      client.email,
      client.phone ?? '',
      client.country ?? '',
      client.kycStatus,
      String(client.balance),
      String(client.accounts),
      client.registeredAt,
      client.lastLoginAt ?? '',
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `autovestai-crm-${Date.now()}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  async function handleAddNote(client: CrmClientListItem) {
    const content = window.prompt(`Add an internal note for ${client.accountNumber}`);

    if (!content?.trim()) {
      return;
    }

    try {
      await crmApi.addNote(client.id, {
        noteType: 'GENERAL',
        content,
      });
      pushNotification({
        title: 'Note added',
        description: `Internal note saved for ${client.accountNumber}.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to add note',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  async function handleSuspend(client: CrmClientListItem) {
    try {
      await adminApi.suspendUser(client.id);
      setClients((current) =>
        current.map((entry) =>
          entry.id === client.id
            ? {
                ...entry,
                accountStatus: 'SUSPENDED',
              }
            : entry,
        ),
      );
      pushNotification({
        title: 'Client suspended',
        description: `${client.accountNumber} has been suspended.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to suspend client',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-border bg-surface p-6 shadow-shell">
        <p className="label-eyebrow">Client Management</p>
        <h1 className="mt-2 text-3xl font-semibold text-primary">CRM / Clients</h1>
        <p className="mt-3 max-w-3xl text-sm text-secondary">
          Search client records by account number, email, or identity profile, then jump directly into compliance, balances, trading, notes, and email history.
        </p>
      </header>

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-shell">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <input
            className="h-11 rounded-2xl border border-border bg-page px-4 text-sm text-primary outline-none transition focus:border-accent"
            placeholder="Search name, email, or account number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="h-11 rounded-2xl border border-border bg-page px-4 text-sm text-primary outline-none transition focus:border-accent"
            value={kycStatus}
            onChange={(event) => setKycStatus(event.target.value)}
          >
            <option value="">All KYC Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <input
            type="date"
            className="h-11 rounded-2xl border border-border bg-page px-4 text-sm text-primary outline-none transition focus:border-accent"
            value={registeredFrom}
            onChange={(event) => setRegisteredFrom(event.target.value)}
          />
          <input
            type="date"
            className="h-11 rounded-2xl border border-border bg-page px-4 text-sm text-primary outline-none transition focus:border-accent"
            value={registeredTo}
            onChange={(event) => setRegisteredTo(event.target.value)}
          />
          <input
            className="h-11 rounded-2xl border border-border bg-page px-4 text-sm text-primary outline-none transition focus:border-accent"
            placeholder="Country"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[#0F172A] px-4 text-sm font-medium text-white transition hover:bg-[#111827]"
            onClick={exportCsv}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-border bg-page px-4 text-sm font-medium text-primary transition hover:border-accent"
            onClick={() => {
              if (selectedClients.length === 0) {
                return;
              }

              router.push(
                `${adminRoute('/crm/email')}?userIds=${encodeURIComponent(selectedClients.map((client) => client.id).join(','))}`,
              );
            }}
            disabled={selectedClients.length === 0 || !canSendEmail}
          >
            Email Selected
          </button>
        </div>
      </section>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-shell">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-page">
              <tr className="text-left text-xs uppercase tracking-[0.14em] text-secondary">
                <th className="px-4 py-3 font-medium">
                  <input
                    type="checkbox"
                    checked={clients.length > 0 && selectedIds.length === clients.length}
                    onChange={(event) =>
                      setSelectedIds(event.target.checked ? clients.map((client) => client.id) : [])
                    }
                  />
                </th>
                {['Account No', 'Full Name', 'Email', 'Phone', 'Country', 'KYC Status', 'Balance', 'Accounts', 'Registered', 'Last Login', 'Actions'].map((label) => (
                  <th key={label} className="px-4 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-secondary">
                    Loading client records...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-secondary">
                    No clients matched the current filters.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="align-top">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(client.id)}
                        onChange={() => toggleSelected(client.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={adminRoute(`/crm/${client.accountNumber}`)}
                        className="font-semibold text-accent underline-offset-4 hover:underline"
                      >
                        {client.accountNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{client.fullName ?? '--'}</td>
                    <td className="px-4 py-3">{client.email}</td>
                    <td className="px-4 py-3">{client.phone ?? '--'}</td>
                    <td className="px-4 py-3">{client.country ?? '--'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={client.kycStatus} />
                    </td>
                    <td className="px-4 py-3">{formatUsdt(client.balance)}</td>
                    <td className="px-4 py-3">{client.accounts}</td>
                    <td className="px-4 py-3">{formatDateTime(client.registeredAt)}</td>
                    <td className="px-4 py-3">
                      {client.lastLoginAt ? formatDateTime(client.lastLoginAt) : '--'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={adminRoute(`/crm/${client.accountNumber}`)}
                          className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-border px-3 text-xs font-medium text-primary transition hover:border-accent"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-border px-3 text-xs font-medium text-primary transition hover:border-accent"
                          onClick={() =>
                            router.push(
                              `${adminRoute('/crm/email')}?userIds=${encodeURIComponent(client.id)}`,
                            )
                          }
                          disabled={!canSendEmail}
                        >
                          Email
                        </button>
                        {canAddNotes ? (
                          <button
                            type="button"
                            className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-border px-3 text-xs font-medium text-primary transition hover:border-accent"
                            onClick={() => void handleAddNote(client)}
                          >
                            Add Note
                          </button>
                        ) : null}
                        {canManageUsers ? (
                          <button
                            type="button"
                            className="inline-flex min-h-[36px] items-center justify-center rounded-full border border-[#7F1D1D] px-3 text-xs font-medium text-[#991B1B] transition hover:bg-[#FEE2E2]"
                            onClick={() => void handleSuspend(client)}
                          >
                            Suspend
                          </button>
                        ) : null}
                      </div>
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
