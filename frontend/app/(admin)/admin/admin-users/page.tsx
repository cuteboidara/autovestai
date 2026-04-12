'use client';

import { Copy, Plus, ShieldCheck, X } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { cn, formatDateTime } from '@/lib/utils';
import { adminApi } from '@/services/api/admin';
import { useNotificationStore } from '@/store/notification-store';
import { AdminUserRole } from '@/types/auth';
import { ManagedAdminUser } from '@/types/admin';

const adminRoleOptions: Array<{ value: AdminUserRole; label: string }> = [
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'SUPPORT', label: 'Support' },
  { value: 'RISK', label: 'Risk' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];

const emptyCreateForm = {
  firstName: '',
  lastName: '',
  email: '',
  role: 'SUPPORT' as AdminUserRole,
  temporaryPassword: '',
};

function generateTemporaryPassword() {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const values = new Uint32Array(12);
  crypto.getRandomValues(values);

  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function getRoleBadgeClass(role: AdminUserRole) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'border border-rose-200 bg-rose-50 text-rose-700';
    case 'COMPLIANCE':
      return 'border border-violet-200 bg-violet-50 text-violet-700';
    case 'SUPPORT':
      return 'border border-sky-200 bg-sky-50 text-sky-700';
    case 'RISK':
      return 'border border-orange-200 bg-orange-50 text-orange-700';
    case 'FINANCE':
      return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
    default:
      return 'border border-slate-200 bg-slate-50 text-slate-700';
  }
}

function getInitials(admin: Pick<ManagedAdminUser, 'firstName' | 'lastName' | 'email'>) {
  const fromName = `${admin.firstName} ${admin.lastName}`.trim();

  if (fromName) {
    return fromName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  return admin.email.slice(0, 2).toUpperCase();
}

function AdminModal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/35 p-3 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-surface shadow-shell sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h2 className="text-xl font-semibold text-primary">{title}</h2>
            <p className="mt-2 text-sm text-secondary">{description}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-page text-secondary transition hover:text-primary"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}

export default function AdminUsersManagementPage() {
  const { hasPermission, user } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const [admins, setAdmins] = useState<ManagedAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ManagedAdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<ManagedAdminUser | null>(null);
  const [toggleTarget, setToggleTarget] = useState<ManagedAdminUser | null>(null);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [submittingReset, setSubmittingReset] = useState(false);
  const [submittingToggle, setSubmittingToggle] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editForm, setEditForm] = useState({
    role: 'SUPPORT' as AdminUserRole,
    isActive: true,
  });
  const canManageAdmins = hasPermission('admin-users.manage');
  const isSeededSuperAdmin = user?.isSeededSuperAdmin ?? false;

  async function loadAdmins() {
    const response = await adminApi.listAdminAccounts();
    setAdmins(response);
  }

  useEffect(() => {
    if (!canManageAdmins) {
      return;
    }

    let active = true;
    setLoading(true);

    void loadAdmins()
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load admin accounts',
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
  }, [canManageAdmins, pushNotification]);

  useEffect(() => {
    if (!createOpen) {
      return;
    }

    setCreateForm((current) => ({
      ...current,
      temporaryPassword: generateTemporaryPassword(),
    }));
  }, [createOpen]);

  useEffect(() => {
    if (!editTarget) {
      return;
    }

    setEditForm({
      role: editTarget.role,
      isActive: editTarget.isActive,
    });
  }, [editTarget]);

  const sortedAdmins = useMemo(
    () =>
      [...admins].sort((left, right) => {
        if (left.role === 'SUPER_ADMIN' && right.role !== 'SUPER_ADMIN') {
          return -1;
        }

        if (right.role === 'SUPER_ADMIN' && left.role !== 'SUPER_ADMIN') {
          return 1;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      }),
    [admins],
  );

  function canChangeSuperAdmin(target: ManagedAdminUser) {
    return target.role !== 'SUPER_ADMIN' || isSeededSuperAdmin || target.id === user?.id;
  }

  function canToggleActive(target: ManagedAdminUser) {
    if (target.id === user?.id) {
      return false;
    }

    if (target.role === 'SUPER_ADMIN' && !isSeededSuperAdmin) {
      return false;
    }

    return true;
  }

  async function copyPassword(value: string) {
    await navigator.clipboard.writeText(value);
    pushNotification({
      title: 'Copied',
      description: 'Temporary password copied to clipboard.',
      type: 'success',
    });
  }

  async function handleCreateAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingCreate(true);

    try {
      const response = await adminApi.createAdminAccount(createForm);
      setAdmins((current) => [response.admin, ...current]);
      setRevealedPassword(response.temporaryPassword);
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
      pushNotification({
        title: 'Admin created',
        description: response.welcomeEmailSent
          ? 'The welcome email was sent successfully.'
          : 'The admin was created. Welcome email delivery was skipped.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to create admin',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSubmittingCreate(false);
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editTarget) {
      return;
    }

    setSubmittingEdit(true);

    try {
      const updated = await adminApi.updateAdminAccount(editTarget.id, editForm);
      setAdmins((current) =>
        current.map((admin) => (admin.id === updated.id ? updated : admin)),
      );
      setEditTarget(null);
      pushNotification({
        title: 'Admin updated',
        description: `${updated.fullName} has been updated.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to update admin',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSubmittingEdit(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) {
      return;
    }

    setSubmittingReset(true);

    try {
      await adminApi.resetAdminAccountPassword(resetTarget.id);
      setResetTarget(null);
      pushNotification({
        title: 'Password reset email sent',
        description: `A reset email was sent to ${resetTarget.email}.`,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to reset password',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSubmittingReset(false);
    }
  }

  async function handleToggleAdmin() {
    if (!toggleTarget) {
      return;
    }

    setSubmittingToggle(true);

    try {
      const updated = toggleTarget.isActive
        ? await adminApi.deactivateAdminAccount(toggleTarget.id)
        : await adminApi.updateAdminAccount(toggleTarget.id, { isActive: true });
      setAdmins((current) =>
        current.map((admin) => (admin.id === updated.id ? updated : admin)),
      );
      setToggleTarget(null);
      pushNotification({
        title: updated.isActive ? 'Admin reactivated' : 'Admin deactivated',
        description: updated.email,
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to update admin status',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSubmittingToggle(false);
    }
  }

  if (!canManageAdmins) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Settings"
          title="Admin Access"
          description="Manage who can access the control tower."
        />
        <PermissionDenied
          title="Admin access management unavailable"
          description="This admin account does not have permission to manage control tower access."
          requiredPermission="admin-users.manage"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Admin Access"
        description="Manage who can access the control tower."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Admin
          </Button>
        }
      />

      {revealedPassword ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Admin created. Temporary password: {revealedPassword}
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              This value is shown once in this session.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => void copyPassword(revealedPassword)}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="ghost" onClick={() => setRevealedPassword(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}

      <Panel
        title="Admin Accounts"
        description="Create, edit, reset, and deactivate control-tower access."
      >
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="min-w-[940px] table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-secondary">
              <tr>
                <th className="pb-3">Avatar</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Last Login</th>
                <th className="pb-3">Created</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-secondary">
                    Loading admin accounts...
                  </td>
                </tr>
              ) : sortedAdmins.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-secondary">
                    No admin accounts found.
                  </td>
                </tr>
              ) : (
                sortedAdmins.map((admin) => (
                  <tr key={admin.id} className="align-top">
                    <td className="py-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0F172A] text-sm font-semibold text-white">
                        {getInitials(admin)}
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-primary">{admin.fullName}</p>
                        {admin.isSeededSuperAdmin ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-secondary">
                        {admin.createdBy?.fullName ?? 'Seeded account'}
                      </p>
                    </td>
                    <td className="py-4 text-secondary">{admin.email}</td>
                    <td className="py-4">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]',
                          getRoleBadgeClass(admin.role),
                        )}
                      >
                        {admin.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-4">
                      <span className="inline-flex items-center gap-2 text-sm text-primary">
                        <span
                          className={cn(
                            'h-2.5 w-2.5 rounded-full',
                            admin.isActive ? 'bg-emerald-500' : 'bg-slate-400',
                          )}
                        />
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 text-secondary">
                      {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : '--'}
                    </td>
                    <td className="py-4 text-secondary">{formatDateTime(admin.createdAt)}</td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={!canChangeSuperAdmin(admin)}
                          onClick={() => setEditTarget(admin)}
                        >
                          Edit Role
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setResetTarget(admin)}
                        >
                          Reset Password
                        </Button>
                        <Button
                          variant={admin.isActive ? 'danger' : 'secondary'}
                          disabled={!canToggleActive(admin)}
                          onClick={() => setToggleTarget(admin)}
                        >
                          {admin.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <AdminModal
        open={createOpen}
        title="Create Admin"
        description="Provision a new control-tower admin account with a temporary password."
        onClose={() => setCreateOpen(false)}
      >
        <form className="space-y-5" onSubmit={handleCreateAdmin}>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="First Name"
              value={createForm.firstName}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, firstName: event.target.value }))
              }
              required
            />
            <Input
              label="Last Name"
              value={createForm.lastName}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, lastName: event.target.value }))
              }
              required
            />
          </div>
          <Input
            label="Email Address"
            type="email"
            value={createForm.email}
            onChange={(event) =>
              setCreateForm((current) => ({ ...current, email: event.target.value }))
            }
            required
          />
          <div className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Select
              label="Role"
              value={createForm.role}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  role: event.target.value as AdminUserRole,
                }))
              }
            >
              {adminRoleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label="Temporary Password"
              value={createForm.temporaryPassword}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  temporaryPassword: event.target.value,
                }))
              }
              helperText="This password is displayed once after creation and emailed when a sender is configured."
              required
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                setCreateForm((current) => ({
                  ...current,
                  temporaryPassword: generateTemporaryPassword(),
                }))
              }
            >
              Regenerate Password
            </Button>
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingCreate}>
                {submittingCreate ? 'Creating...' : 'Create Admin'}
              </Button>
            </div>
          </div>
        </form>
      </AdminModal>

      <AdminModal
        open={Boolean(editTarget)}
        title="Edit Admin"
        description="Update the admin role and account status."
        onClose={() => setEditTarget(null)}
      >
        <form className="space-y-5" onSubmit={handleSaveEdit}>
          <Select
            label="Role"
            value={editForm.role}
            onChange={(event) =>
              setEditForm((current) => ({
                ...current,
                role: event.target.value as AdminUserRole,
              }))
            }
          >
            {adminRoleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-3 rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
            <input
              type="checkbox"
              checked={editForm.isActive}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            <span>Admin account is active</span>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" type="button" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submittingEdit}>
              {submittingEdit ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </AdminModal>

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="Reset Admin Password"
        description={
          resetTarget
            ? `Send password reset email to ${resetTarget.email}?`
            : ''
        }
        confirmLabel="Send Reset Email"
        loading={submittingReset}
        onCancel={() => setResetTarget(null)}
        onConfirm={() => void handleResetPassword()}
      />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={toggleTarget?.isActive ? 'Deactivate Admin' : 'Activate Admin'}
        description={
          toggleTarget
            ? toggleTarget.isActive
              ? `Deactivate ${toggleTarget.email}? They will receive a 401 on their next request.`
              : `Reactivate ${toggleTarget.email}?`
            : ''
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        tone={toggleTarget?.isActive ? 'danger' : 'primary'}
        loading={submittingToggle}
        onCancel={() => setToggleTarget(null)}
        onConfirm={() => void handleToggleAdmin()}
      />
    </div>
  );
}
