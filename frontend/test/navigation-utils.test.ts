import { describe, expect, it } from 'vitest';

import type { AppNavGroup } from '@/components/navigation/navigation.types';
import { getNavMatchScore, resolveActiveNav } from '@/components/navigation/navigation.utils';

const navGroups: AppNavGroup[] = [
  {
    label: 'Admin',
    items: [
      { href: '/admin', label: 'Overview', matchMode: 'exact' },
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/treasury', label: 'Treasury' },
    ],
  },
  {
    label: 'Client',
    items: [
      { href: '/wallet', label: 'Wallet' },
      { href: '/wallet?tab=deposit', label: 'Deposit' },
    ],
  },
];

describe('navigation route matching', () => {
  it('prefers the most specific query-driven item on shared paths', () => {
    const resolved = resolveActiveNav(
      navGroups,
      '/wallet',
      new URLSearchParams('tab=deposit'),
    );

    expect(resolved.activeItem?.label).toBe('Deposit');
    expect(resolved.activeGroup?.label).toBe('Client');
  });

  it('keeps section navigation active for nested routes', () => {
    const resolved = resolveActiveNav(navGroups, '/admin/users/123', new URLSearchParams());

    expect(resolved.activeItem?.label).toBe('Users');
  });

  it('does not treat exact overview routes as active for unrelated nested pages', () => {
    const overviewScore = getNavMatchScore(
      navGroups[0].items[0],
      '/admin/unknown',
      new URLSearchParams(),
    );

    expect(overviewScore).toBe(-1);
  });
});
