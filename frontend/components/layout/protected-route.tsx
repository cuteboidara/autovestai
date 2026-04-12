'use client';

import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useAuth } from '@/hooks/use-auth';
import { adminRoute } from '@/lib/admin-route';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  guestOnly?: boolean;
  allowUnapprovedKyc?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin = false,
  guestOnly = false,
  allowUnapprovedKyc = false,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    hydrated,
    user,
    isAuthenticated,
    isAdmin,
    isKycApproved,
    getAuthenticatedHomeRoute,
  } = useAuth();

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (guestOnly && isAuthenticated) {
      router.replace(getAuthenticatedHomeRoute());
      return;
    }

    if (!guestOnly && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    if (requireAdmin && user && !isAdmin) {
      router.replace(getAuthenticatedHomeRoute());
      return;
    }

    if (allowUnapprovedKyc && user) {
      if (isAdmin) {
        router.replace(adminRoute());
        return;
      }

      if (isKycApproved) {
        router.replace('/dashboard');
      }
      return;
    }

    if (!requireAdmin && user && !isAdmin && !isKycApproved) {
      router.replace('/kyc');
    }
  }, [
    allowUnapprovedKyc,
    getAuthenticatedHomeRoute,
    guestOnly,
    hydrated,
    isAdmin,
    isAuthenticated,
    isKycApproved,
    pathname,
    requireAdmin,
    router,
    user,
  ]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page">
        <div className="rounded-2xl border border-border bg-surface px-6 py-4 text-sm text-secondary shadow-glow">
          Bootstrapping workspace...
        </div>
      </div>
    );
  }

  if (guestOnly) {
    return isAuthenticated ? null : <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return null;
  }

  if (allowUnapprovedKyc) {
    return isAdmin || isKycApproved ? null : <>{children}</>;
  }

  if (!isAdmin && !isKycApproved) {
    return null;
  }

  return <>{children}</>;
}
