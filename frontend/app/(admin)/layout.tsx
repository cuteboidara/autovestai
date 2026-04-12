'use client';

import { ReactNode, useEffect, useState } from 'react';
import {
  ArrowUpFromLine,
  ClipboardCheck,
  LayoutList,
  LayoutDashboard,
  MessageSquareText,
  Radar,
  Settings,
  Shield,
  Users,
  Mail,
} from 'lucide-react';

import { AdminChatBootstrap } from '@/components/layout/admin-chat-bootstrap';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/layout/protected-route';
import type { AppNavGroup } from '@/components/navigation/navigation.types';
import { useAuth } from '@/hooks/use-auth';
import { adminRoute } from '@/lib/admin-route';
import { adminApi } from '@/services/api/admin';
import { useAdminChatStore } from '@/store/admin-chat-store';

const navGroups = [
  {
    label: 'Overview',
    items: [
      {
        href: adminRoute(),
        label: 'Dashboard',
        icon: <LayoutDashboard className="h-4 w-4" />,
        matchMode: 'exact',
        permissions: ['dashboard.view'],
      },
    ],
  },
  {
    label: 'Client Management',
    items: [
      {
        href: adminRoute('/crm'),
        label: 'CRM / Clients',
        icon: <Users className="h-4 w-4" />,
        permissions: ['crm.read'],
      },
      {
        href: adminRoute('/crm/email'),
        label: 'Email Center',
        icon: <Mail className="h-4 w-4" />,
        permissions: ['email.send'],
      },
    ],
  },
  {
    label: 'Trading',
    items: [
      {
        href: adminRoute('/positions'),
        label: 'Live Positions',
        icon: <LayoutList className="h-4 w-4" />,
        permissions: ['positions.view'],
      },
      {
        href: adminRoute('/orders'),
        label: 'All Orders',
        icon: <ClipboardCheck className="h-4 w-4" />,
        permissions: ['orders.view'],
      },
      {
        href: adminRoute('/risk'),
        label: 'Risk Monitor',
        icon: <Radar className="h-4 w-4" />,
        permissions: ['risk.view'],
      },
    ],
  },
  {
    label: 'Compliance',
    items: [
      {
        href: adminRoute('/kyc'),
        label: 'KYC Review',
        icon: <Shield className="h-4 w-4" />,
        permissions: ['kyc.approve'],
      },
      {
        href: adminRoute('/surveillance'),
        label: 'Surveillance',
        icon: <Shield className="h-4 w-4" />,
        permissions: ['alerts.view'],
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        href: adminRoute('/wallet'),
        label: 'Transactions',
        icon: <ClipboardCheck className="h-4 w-4" />,
        permissions: ['transactions.view'],
      },
      {
        href: adminRoute('/withdrawals'),
        label: 'Withdrawals',
        icon: <ArrowUpFromLine className="h-4 w-4" />,
        permissions: ['transactions.view'],
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        href: adminRoute('/chat'),
        label: 'Internal Chat',
        icon: <MessageSquareText className="h-4 w-4" />,
        permissions: ['chat.view'],
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      {
        href: adminRoute('/crm/settings/email-senders'),
        label: 'Email Senders',
        icon: <Mail className="h-4 w-4" />,
        permissions: ['email.settings'],
      },
      {
        href: adminRoute('/admin-users'),
        label: 'Admin Access',
        icon: <Users className="h-4 w-4" />,
        permissions: ['admin-users.manage'],
      },
      {
        href: adminRoute('/settings'),
        label: 'Admin Settings',
        icon: <Settings className="h-4 w-4" />,
        permissions: ['settings.manage'],
      },
    ],
  },
] satisfies Array<
  AppNavGroup & {
    items: Array<
      AppNavGroup['items'][number] & {
        permissions?: string[];
      }
    >;
  }
>;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { hasPermission } = useAuth();
  const unreadCounts = useAdminChatStore((state) => state.unreadCounts);
  const chatBadge = unreadCounts.general + unreadCounts.compliance + unreadCounts.risk;
  const canViewTransactions = hasPermission('transactions.view');
  const [pendingWithdrawalCount, setPendingWithdrawalCount] = useState<number | null>(null);

  useEffect(() => {
    if (!canViewTransactions) {
      return;
    }

    let active = true;

    void adminApi
      .getOverview()
      .then((overview) => {
        if (active) {
          setPendingWithdrawalCount(overview.pendingWithdrawals);
        }
      })
      .catch(() => {
        if (active) {
          setPendingWithdrawalCount(null);
        }
      });

    return () => {
      active = false;
    };
  }, [canViewTransactions]);

  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter(
          (item) =>
            !item.permissions || item.permissions.some((permission) => hasPermission(permission)),
        )
        .map((item) =>
          item.href === adminRoute('/chat')
            ? {
                ...item,
                badge: chatBadge > 0 ? chatBadge : null,
              }
            : item.href === adminRoute('/withdrawals')
              ? {
                  ...item,
                  badge:
                    pendingWithdrawalCount && pendingWithdrawalCount > 0
                      ? pendingWithdrawalCount
                      : null,
                }
            : item,
        ),
    }))
    .filter((group) => group.items.length > 0);

  const canAccessBackoffice = filteredNavGroups.some((group) =>
    group.items.some((item) => item.href === adminRoute()),
  );

  return (
    <ProtectedRoute requireAdmin>
      <AdminChatBootstrap />
      <AppShell
        title={canAccessBackoffice ? 'Broker Backoffice' : 'Admin Console'}
        badgeLabel="Admin"
        navGroups={filteredNavGroups}
      >
        {children}
      </AppShell>
    </ProtectedRoute>
  );
}
