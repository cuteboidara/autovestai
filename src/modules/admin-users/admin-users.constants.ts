import { AdminRole } from '@prisma/client';

export const SUPER_ADMIN_PERMISSION_KEYS = [
  'dashboard.view',
  'crm.read',
  'crm.notes',
  'crm.write',
  'kyc.approve',
  'kyc.view',
  'alerts.view',
  'alerts.manage',
  'risk.view',
  'risk.manage',
  'positions.view',
  'positions.manage',
  'queues.manage',
  'transactions.view',
  'deposits.approve',
  'withdrawals.approve',
  'email.send',
  'admin.users.manage',
  'settings.manage',
  // App-specific permissions that are still checked across the current panel.
  'email.settings',
  'orders.view',
  'chat.view',
  'admin-users.manage',
  'copy.approve',
  'affiliate.manage',
  'audit.view',
  'treasury.view',
  'treasury.manage',
  'health.view',
  'readiness.view',
  'users.view',
  'users.manage',
  'users.credit',
  'dealingdesk.manage',
] as const;

export const ADMIN_PERMISSION_KEYS = [
  ...SUPER_ADMIN_PERMISSION_KEYS,
] as const;

export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const DEFAULT_ADMIN_ROLE_PERMISSIONS: Record<AdminRole, AdminPermissionKey[]> = {
  [AdminRole.SUPER_ADMIN]: [...SUPER_ADMIN_PERMISSION_KEYS],
  [AdminRole.COMPLIANCE]: ['crm.read', 'crm.notes', 'kyc.approve', 'alerts.view'],
  [AdminRole.SUPPORT]: ['crm.read', 'crm.notes', 'email.send'],
  [AdminRole.RISK]: ['risk.view', 'positions.view', 'queues.manage'],
  [AdminRole.FINANCE]: [
    'transactions.view',
    'deposits.approve',
    'withdrawals.approve',
    'users.credit',
  ],
};

export function getDefaultPermissionsForAdminRole(role: AdminRole): string[] {
  return [...DEFAULT_ADMIN_ROLE_PERMISSIONS[role]];
}

export function isSuperAdminRole(role: AdminRole | null | undefined): boolean {
  return role === AdminRole.SUPER_ADMIN;
}
