import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminLayout from '@/app/(admin)/layout';

const { hasPermissionMock } = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    hasPermission: hasPermissionMock,
  }),
}));

vi.mock('@/components/layout/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({
    navGroups,
    children,
  }: {
    navGroups: Array<{ items: Array<{ label: string }> }>;
    children: React.ReactNode;
  }) => (
    <div>
      <div data-testid="nav-items">
        {navGroups.flatMap((group) => group.items).map((item) => item.label).join(', ')}
      </div>
      {children}
    </div>
  ),
}));

describe('AdminLayout', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset();
  });

  it('filters admin navigation by permission', () => {
    hasPermissionMock.mockImplementation(
      (permission: string) =>
        permission === 'dashboard.view' || permission === 'alerts.view',
    );

    render(
      <AdminLayout>
        <div>admin content</div>
      </AdminLayout>,
    );

    expect(screen.getByTestId('nav-items')).toHaveTextContent('Dashboard');
    expect(screen.getByTestId('nav-items')).toHaveTextContent('Surveillance');
    expect(screen.getByTestId('nav-items')).not.toHaveTextContent('CRM / Clients');
    expect(screen.getByTestId('nav-items')).not.toHaveTextContent('Settings');
    expect(screen.getByTestId('nav-items')).not.toHaveTextContent('Admin Access');
    expect(screen.getByTestId('nav-items')).not.toHaveTextContent('Internal Chat');
  });

  it('shows settings navigation items when their permissions are granted', () => {
    hasPermissionMock.mockImplementation(
      (permission: string) =>
        permission === 'dashboard.view' ||
        permission === 'email.settings' ||
        permission === 'admin-users.manage',
    );

    render(
      <AdminLayout>
        <div>admin content</div>
      </AdminLayout>,
    );

    expect(screen.getByTestId('nav-items')).toHaveTextContent('Email Senders');
    expect(screen.getByTestId('nav-items')).toHaveTextContent('Admin Access');
  });
});
