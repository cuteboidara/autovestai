import type { ReactNode } from 'react';

export type AppNavMatchMode = 'exact' | 'section';

export interface AppNavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  matchMode?: AppNavMatchMode;
  badge?: number | string | null;
}

export interface AppNavGroup {
  label: string;
  items: AppNavItem[];
}

export interface ResolvedNavState {
  activeGroup: AppNavGroup | null;
  activeItem: AppNavItem | null;
  activeScore: number;
}
