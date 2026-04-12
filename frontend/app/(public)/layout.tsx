'use client';

import { ReactNode } from 'react';

import { ProtectedRoute } from '@/components/layout/protected-route';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return <ProtectedRoute guestOnly>{children}</ProtectedRoute>;
}
