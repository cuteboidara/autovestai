'use client';

import { ReactNode, useEffect } from 'react';

import { useAuthStore } from '@/store/auth-store';

export function AuthProvider({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setHydrated = useAuthStore((state) => state.setHydrated);

  useEffect(() => {
    void bootstrap().finally(() => setHydrated(true));
  }, [bootstrap, setHydrated]);

  useEffect(() => {
    const handleExpiredSession = () => {
      clearSession();
    };

    window.addEventListener('autovestai:auth-expired', handleExpiredSession);

    return () => {
      window.removeEventListener('autovestai:auth-expired', handleExpiredSession);
    };
  }, [clearSession]);

  return <>{children}</>;
}
