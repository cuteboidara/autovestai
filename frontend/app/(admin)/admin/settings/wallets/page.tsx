'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { PlatformDepositWallet } from '@/types/wallet';

interface WalletFormState {
  network: string;
  coin: string;
  address: string;
  label: string;
  minDeposit: string;
  isActive: boolean;
}

const emptyForm: WalletFormState = {
  network: 'TRC20',
  coin: 'USDT',
  address: '',
  label: '',
  minDeposit: '10',
  isActive: true,
};

export default function AdminDepositWalletsPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [wallets, setWallets] = useState<PlatformDepositWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformDepositWallet | null>(null);
  const [form, setForm] = useState<WalletFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformDepositWallet | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canManage = hasPermission('settings.manage');

  async function refresh() {
    try {
      const data = await adminApi.listDepositWallets();
      setWallets(data);
    } catch {
      pushNotification({ title: 'Failed to load wallets', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canManage) return;
    void refresh();
  }, [canManage]);

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Settings / Deposit Wallets"
          title="Platform deposit wallets"
          description="Configure the wallet addresses clients send crypto to."
        />
        <PermissionDenied
          title="Access denied"
          description="You do not have permission to manage deposit wallet settings."
          requiredPermission="settings.manage"
        />
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(wallet: PlatformDepositWallet) {
    setEditing(wallet);
    setForm({
      network: wallet.network,
      coin: wallet.coin,
      address: wallet.address,
      label: wallet.label ?? '',
      minDeposit: String(wallet.minDeposit),
      isActive: wallet.isActive,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.network.trim() || !form.address.trim()) {
      pushNotification({ title: 'Network and address are required', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await adminApi.updateDepositWallet(editing.id, {
          address: form.address.trim(),
          label: form.label.trim() || undefined,
          isActive: form.isActive,
          minDeposit: Number(form.minDeposit) || 10,
        });
        pushNotification({ title: 'Wallet updated', type: 'success' });
      } else {
        await adminApi.createDepositWallet({
          network: form.network.trim().toUpperCase(),
          coin: form.coin.trim().toUpperCase() || 'USDT',
          address: form.address.trim(),
          label: form.label.trim() || undefined,
          isActive: form.isActive,
          minDeposit: Number(form.minDeposit) || 10,
        });
        pushNotification({ title: 'Wallet created', type: 'success' });
      }
      setFormOpen(false);
      await refresh();
    } catch (error) {
      pushNotification({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteDepositWallet(deleteTarget.id);
      pushNotification({ title: 'Wallet deleted', type: 'success' });
      setDeleteTarget(null);
      await refresh();
    } catch (error) {
      pushNotification({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings / Deposit Wallets"
        title="Platform deposit wallets"
        description="Manage the wallet addresses displayed to clients on the deposit page. Clients copy the platform address and send crypto manually."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add wallet
          </Button>
        }
      />

      <Panel title="Configured wallets" description="Active wallets are shown to clients during deposit.">
        {loading ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : wallets.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-semibold text-primary">No wallets configured</p>
            <p className="mt-1 text-sm text-secondary">
              Add a wallet address so clients know where to send funds.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add first wallet
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-secondary">
                  <th className="pb-3 pr-4">Network</th>
                  <th className="pb-3 pr-4">Coin</th>
                  <th className="pb-3 pr-4">Address</th>
                  <th className="pb-3 pr-4">Label</th>
                  <th className="pb-3 pr-4">Min deposit</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {wallets.map((wallet) => (
                  <tr key={wallet.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-semibold text-primary">{wallet.network}</td>
                    <td className="py-3 pr-4 text-secondary">{wallet.coin}</td>
                    <td className="py-3 pr-4 max-w-[220px] truncate font-mono text-xs text-primary" title={wallet.address}>
                      {wallet.address}
                    </td>
                    <td className="py-3 pr-4 text-secondary">{wallet.label ?? '—'}</td>
                    <td className="py-3 pr-4 text-secondary">${wallet.minDeposit}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge value={wallet.isActive ? 'ACTIVE' : 'DISABLED'} />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-secondary transition hover:bg-hover hover:text-primary"
                          onClick={() => openEdit(wallet)}
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-secondary transition hover:bg-danger/10 hover:text-danger"
                          onClick={() => setDeleteTarget(wallet)}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Create / Edit dialog */}
      <ConfirmDialog
        open={formOpen}
        title={editing ? 'Edit deposit wallet' : 'Add deposit wallet'}
        description={
          editing
            ? 'Update the address or settings for this wallet.'
            : 'Add a new platform wallet address for clients to send deposits to.'
        }
        confirmLabel={saving ? 'Saving…' : editing ? 'Save changes' : 'Create wallet'}
        onCancel={() => setFormOpen(false)}
        onConfirm={() => void handleSave()}
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Network"
              placeholder="TRC20"
              value={form.network}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
            />
            <Input
              label="Coin"
              placeholder="USDT"
              value={form.coin}
              disabled={!!editing}
              onChange={(e) => setForm((f) => ({ ...f, coin: e.target.value }))}
            />
          </div>
          <Input
            label="Wallet address"
            placeholder="Paste wallet address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Input
            label="Label (optional)"
            placeholder="e.g. Main TRC20 wallet"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
          <Input
            label="Min deposit (USD)"
            type="number"
            min="0"
            step="1"
            value={form.minDeposit}
            onChange={(e) => setForm((f) => ({ ...f, minDeposit: e.target.value }))}
          />
          <label className="flex cursor-pointer items-center gap-3 text-sm text-primary">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-border accent-accent"
            />
            Active (visible to clients)
          </label>
        </div>
      </ConfirmDialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete wallet"
        description={`Remove the ${deleteTarget?.network} ${deleteTarget?.coin} wallet? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        tone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
