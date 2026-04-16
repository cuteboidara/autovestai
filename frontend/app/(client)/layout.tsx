'use client';

import { ReactNode } from 'react';
import {
  LayoutDashboard,
  LineChart,
  Receipt,
  Wallet,
  Copy,
  ArrowDownToLine,
  ArrowUpFromLine,
  Headset,
  BriefcaseBusiness,
} from 'lucide-react';

import { AppShell } from '@/components/layout/app-shell';
import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { ProtectedRoute } from '@/components/layout/protected-route';
import type { AppNavGroup } from '@/components/navigation/navigation.types';

const navGroups = [
  {
    label: 'Trading',
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        matchMode: 'exact',
      },
      {
        href: '/trade',
        label: 'Terminal',
        icon: <LineChart className="h-4 w-4" />,
        matchMode: 'exact',
      },
      { href: '/orders', label: 'Orders', icon: <Receipt className="h-4 w-4" />, matchMode: 'exact' },
      { href: '/positions', label: 'Positions', icon: <LayoutDashboard className="h-4 w-4" />, matchMode: 'exact' },
      { href: '/copy-trading', label: 'Copy Trading', icon: <Copy className="h-4 w-4" />, matchMode: 'exact' },
    ],
  },
  {
    label: 'Wallet',
    items: [
      { href: '/wallet', label: 'Wallet', icon: <Wallet className="h-4 w-4" /> },
      { href: '/deposit', label: 'Deposit', icon: <ArrowDownToLine className="h-4 w-4" /> },
      { href: '/withdraw', label: 'Withdraw', icon: <ArrowUpFromLine className="h-4 w-4" /> },
      { href: '/wallet', label: 'Transactions', icon: <Receipt className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/accounts', label: 'Accounts', icon: <BriefcaseBusiness className="h-4 w-4" />, matchMode: 'exact' },
      { href: '/support', label: 'Support', icon: <Headset className="h-4 w-4" />, matchMode: 'exact' },
    ],
  },
] satisfies AppNavGroup[];

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <EmailVerificationBanner />
      <AppShell title="Client Portal" navGroups={navGroups} theme="client">
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
