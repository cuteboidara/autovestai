'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

import { AuthProvider } from '@/components/auth/auth-provider';
import { PlatformBanner } from '@/components/layout/platform-banner';
import { PlatformStatusBootstrap } from '@/components/layout/platform-status-bootstrap';
import { NotificationViewport } from '@/components/ui/notification-viewport';
import { SocketBootstrap } from '@/components/layout/socket-bootstrap';
import { AccountProvider } from '@/context/account-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AccountProvider>
          <PlatformStatusBootstrap />
          <PlatformBanner />
          <SocketBootstrap />
          {children}
          <NotificationViewport />
        </AccountProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
