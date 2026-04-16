import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminReadinessPage from '@/app/(admin)/admin/readiness/page';

const { hasPermissionMock, getReadinessMock } = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
  getReadinessMock: vi.fn(),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    hasPermission: hasPermissionMock,
  }),
}));

vi.mock('@/services/api/admin', () => ({
  adminApi: {
    getReadiness: getReadinessMock,
  },
}));

describe('AdminReadinessPage', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset();
    getReadinessMock.mockReset();
    hasPermissionMock.mockReturnValue(true);
  });

  it('renders structured readiness sections without JSON dumping', async () => {
    getReadinessMock.mockResolvedValue([
      {
        key: 'db_connected',
        label: 'DB connected',
        category: 'infra',
        status: 'ok',
        summary: 'Database responded successfully.',
        detail: 'Database responded to SELECT 1.',
        action: null,
      },
      {
        key: 'provider_twelve',
        label: 'Twelve Data',
        category: 'providers',
        status: 'warning',
        summary: 'TWELVE_DATA_API_KEY is not configured.',
        detail: 'TWELVE_DATA_API_KEY is not configured.',
        fields: [
          { label: 'Status', value: 'MISCONFIGURED' },
          { label: 'Reason', value: 'missing_api_key' },
          { label: 'Symbols', value: '12' },
        ],
        action: 'Set TWELVE_DATA_API_KEY or disable Twelve Data realtime explicitly.',
      },
    ]);

    render(<AdminReadinessPage />);

    await waitFor(() => {
      expect(getReadinessMock).toHaveBeenCalled();
    });

    expect(await screen.findByText('Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Market Providers')).toBeInTheDocument();
    expect(screen.getByText('Database responded successfully.')).toBeInTheDocument();
    expect(screen.getAllByText('TWELVE_DATA_API_KEY is not configured.').length).toBeGreaterThan(0);
    expect(screen.getByText('missing api key')).toBeInTheDocument();
    expect(
      screen.getByText('Set TWELVE_DATA_API_KEY or disable Twelve Data realtime explicitly.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\{"orderQueue"/)).not.toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });
});
