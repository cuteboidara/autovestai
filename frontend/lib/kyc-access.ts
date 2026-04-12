import { AuthUser } from '@/types/auth';
import { KycSubmission } from '@/types/kyc';
import { adminRoute } from './admin-route';

export function getAdminHomeRoute(user?: AuthUser | null): string {
  if (!user || user.role !== 'ADMIN') {
    return adminRoute();
  }

  if (user.permissions.includes('dashboard.view')) {
    return adminRoute();
  }

  if (user.permissions.includes('kyc.approve')) {
    return adminRoute('/kyc');
  }

  if (user.permissions.includes('risk.view')) {
    return adminRoute('/risk');
  }

  if (user.permissions.includes('alerts.view')) {
    return adminRoute('/surveillance');
  }

  if (user.permissions.includes('transactions.view')) {
    return adminRoute('/wallet');
  }

  if (user.permissions.includes('positions.view')) {
    return adminRoute('/positions');
  }

  if (user.permissions.includes('email.send')) {
    return adminRoute('/crm/email');
  }

  if (user.permissions.includes('crm.read')) {
    return adminRoute('/crm');
  }

  return adminRoute();
}

export function getUserKycStatus(user?: AuthUser | null): KycSubmission['status'] {
  const status = user?.kyc?.status?.toUpperCase();

  switch (status) {
    case 'APPROVED':
    case 'PENDING':
    case 'REJECTED':
      return status;
    default:
      return 'NOT_SUBMITTED';
  }
}

export function isKycApproved(user?: AuthUser | null): boolean {
  return getUserKycStatus(user) === 'APPROVED';
}

export function requiresKycApproval(user?: AuthUser | null): boolean {
  return Boolean(user && user.role !== 'ADMIN' && !isKycApproved(user));
}

export function getAuthenticatedHomeRoute(user?: AuthUser | null): string {
  if (!user) {
    return '/login';
  }

  if (user.role === 'ADMIN') {
    return getAdminHomeRoute(user);
  }

  return isKycApproved(user) ? '/dashboard' : '/kyc';
}
