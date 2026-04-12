'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { crmApi } from '@/services/api/crm';
import { useNotificationStore } from '@/store/notification-store';
import { CrmEmailSenderConfig } from '@/types/crm';

const emptyForm = {
  name: '',
  fromEmail: '',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  isDefault: false,
  isActive: true,
};

export default function CrmEmailSendersPage() {
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [senders, setSenders] = useState<CrmEmailSenderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSenderId, setEditingSenderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingSenderId, setTestingSenderId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const canManageSenders = hasPermission('email.settings');

  const editingSender = useMemo(
    () => senders.find((sender) => sender.id === editingSenderId) ?? null,
    [editingSenderId, senders],
  );

  async function loadSenders() {
    const response = await crmApi.listSenders();
    setSenders(response);
  }

  useEffect(() => {
    if (!canManageSenders) {
      return;
    }

    let active = true;

    setLoading(true);
    void loadSenders()
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load email senders',
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
  }, [canManageSenders, pushNotification]);

  if (!canManageSenders) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM / Settings"
          title="Email Senders"
          description="Configure SMTP sender identities, default routing, active/inactive status, and delivery testing."
        />
        <PermissionDenied
          title="Email sender settings unavailable"
          description="This admin account does not have permission to manage CRM sender configurations."
          requiredPermission="email.settings"
        />
      </div>
    );
  }

  function startEditing(sender: CrmEmailSenderConfig) {
    setEditingSenderId(sender.id);
    setForm({
      name: sender.name,
      fromEmail: sender.fromEmail,
      smtpHost: sender.smtpHost,
      smtpPort: String(sender.smtpPort),
      smtpUser: sender.smtpUser,
      smtpPass: '',
      isDefault: sender.isDefault,
      isActive: sender.isActive,
    });
  }

  function resetForm() {
    setEditingSenderId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      if (editingSenderId) {
        await crmApi.updateSender(editingSenderId, {
          name: form.name.trim(),
          fromEmail: form.fromEmail.trim(),
          smtpHost: form.smtpHost.trim(),
          smtpPort: Number(form.smtpPort),
          smtpUser: form.smtpUser.trim(),
          ...(form.smtpPass.trim() ? { smtpPass: form.smtpPass } : {}),
          isDefault: form.isDefault,
          isActive: form.isActive,
        });
      } else {
        await crmApi.createSender({
          name: form.name.trim(),
          fromEmail: form.fromEmail.trim(),
          smtpHost: form.smtpHost.trim(),
          smtpPort: Number(form.smtpPort),
          smtpUser: form.smtpUser.trim(),
          smtpPass: form.smtpPass,
          isDefault: form.isDefault,
          isActive: form.isActive,
        });
      }

      await loadSenders();
      pushNotification({
        title: editingSenderId ? 'Sender updated' : 'Sender added',
        description: `${form.fromEmail} is ready for CRM email dispatch.`,
        type: 'success',
      });
      resetForm();
    } catch (error) {
      pushNotification({
        title: editingSenderId ? 'Unable to update sender' : 'Unable to add sender',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(senderId: string) {
    try {
      await crmApi.updateSender(senderId, { isDefault: true });
      await loadSenders();
      pushNotification({
        title: 'Default sender updated',
        description: 'The selected sender is now the CRM default.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to update default sender',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  async function handleDelete(senderId: string) {
    if (!window.confirm('Delete this sender configuration?')) {
      return;
    }

    try {
      await crmApi.deleteSender(senderId);
      await loadSenders();
      if (editingSenderId === senderId) {
        resetForm();
      }
      pushNotification({
        title: 'Sender deleted',
        description: 'The sender configuration has been removed.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to delete sender',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  async function handleTest(senderId: string) {
    setTestingSenderId(senderId);

    try {
      await crmApi.testSender(senderId);
      pushNotification({
        title: 'Test email sent',
        description: 'A test email was sent to the current admin account.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Test email failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setTestingSenderId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM / Settings"
        title="Email Senders"
        description="Configure SMTP sender identities, default routing, active/inactive status, and delivery testing."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Panel title="Configured Senders" description="Active CRM sender identities available to the email center.">
          {loading ? (
            <p className="text-sm text-secondary">Loading sender accounts...</p>
          ) : senders.length === 0 ? (
            <p className="text-sm text-secondary">No CRM sender configurations yet.</p>
          ) : (
            <div className="space-y-3">
              {senders.map((sender) => (
                <div key={sender.id} className="rounded-3xl border border-border bg-page p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-primary">{sender.name}</p>
                      <p className="mt-1 text-sm text-secondary">
                        {sender.fromEmail} • {sender.smtpHost}:{sender.smtpPort}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sender.isDefault ? <StatusBadge value="DEFAULT" /> : null}
                      <StatusBadge value={sender.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {!sender.isDefault ? (
                      <Button variant="secondary" onClick={() => void handleSetDefault(sender.id)}>
                        Set as Default
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => startEditing(sender)}>
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={testingSenderId === sender.id}
                      onClick={() => void handleTest(sender.id)}
                    >
                      {testingSenderId === sender.id ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button variant="danger" onClick={() => void handleDelete(sender.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={editingSender ? 'Edit Sender' : 'Add Sender'}
          description="Display label, SMTP host, auth credentials, and default sender behavior."
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              label="Display Name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder='Support'
              required
            />
            <Input
              label="From Email"
              type="email"
              value={form.fromEmail}
              onChange={(event) =>
                setForm((current) => ({ ...current, fromEmail: event.target.value }))
              }
              placeholder="support@autovestai.com"
              required
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="SMTP Host"
                value={form.smtpHost}
                onChange={(event) =>
                  setForm((current) => ({ ...current, smtpHost: event.target.value }))
                }
                placeholder="smtp.mailprovider.com"
                required
              />
              <Input
                label="SMTP Port"
                type="number"
                value={form.smtpPort}
                onChange={(event) =>
                  setForm((current) => ({ ...current, smtpPort: event.target.value }))
                }
                required
              />
            </div>
            <Input
              label="SMTP Username"
              value={form.smtpUser}
              onChange={(event) =>
                setForm((current) => ({ ...current, smtpUser: event.target.value }))
              }
              required
            />
            <Input
              label={editingSender ? 'SMTP Password (leave blank to keep current)' : 'SMTP Password'}
              type="password"
              value={form.smtpPass}
              onChange={(event) =>
                setForm((current) => ({ ...current, smtpPass: event.target.value }))
              }
              required={!editingSender}
            />

            <label className="flex items-center gap-3 rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isDefault: event.target.checked }))
                }
              />
              <span>Set as default sender</span>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm((current) => ({ ...current, isActive: event.target.checked }))
                }
              />
              <span>Sender is active</span>
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              {editingSender ? (
                <Button variant="secondary" type="button" onClick={resetForm}>
                  Cancel
                </Button>
              ) : null}
              <Button type="submit" disabled={saving}>
                {saving
                  ? editingSender
                    ? 'Updating...'
                    : 'Adding...'
                  : editingSender
                    ? 'Update Sender'
                    : 'Add Sender'}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
