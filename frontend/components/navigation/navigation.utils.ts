import type { ReadonlyURLSearchParams } from 'next/navigation';

import type { AppNavGroup, AppNavItem, ResolvedNavState } from './navigation.types';

type SearchParamsLike = URLSearchParams | ReadonlyURLSearchParams;

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.replace(/\/+$/, '') || '/';
}

function getPathDepth(pathname: string): number {
  return normalizePath(pathname).split('/').filter(Boolean).length;
}

function matchesSectionPath(currentPath: string, itemPath: string): boolean {
  if (itemPath === '/') {
    return currentPath === '/';
  }

  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
}

function getExpectedParams(href: string): URLSearchParams {
  const [, query = ''] = href.split('?');
  return new URLSearchParams(query);
}

export function getNavMatchScore(
  item: AppNavItem,
  pathname: string,
  searchParams: SearchParamsLike,
): number {
  const [hrefPath] = item.href.split('?');
  const itemPath = normalizePath(hrefPath);
  const currentPath = normalizePath(pathname);
  const matchMode = item.matchMode ?? 'section';
  const exactPath = currentPath === itemPath;
  const pathMatches =
    matchMode === 'exact'
      ? exactPath
      : matchesSectionPath(currentPath, itemPath);

  if (!pathMatches) {
    return -1;
  }

  const expectedParams = getExpectedParams(item.href);

  for (const [key, value] of expectedParams.entries()) {
    if (searchParams.get(key) !== value) {
      return -1;
    }
  }

  return (
    expectedParams.size * 1_000 +
    getPathDepth(itemPath) * 100 +
    (exactPath ? 25 : 0) +
    (matchMode === 'exact' ? 5 : 0) +
    itemPath.length
  );
}

export function resolveActiveNav(
  navGroups: AppNavGroup[],
  pathname: string,
  searchParams: SearchParamsLike,
): ResolvedNavState {
  let resolved: ResolvedNavState = {
    activeGroup: null,
    activeItem: null,
    activeScore: -1,
  };

  for (const group of navGroups) {
    for (const item of group.items) {
      const score = getNavMatchScore(item, pathname, searchParams);

      if (score > resolved.activeScore) {
        resolved = {
          activeGroup: group,
          activeItem: item,
          activeScore: score,
        };
      }
    }
  }

  return resolved;
}
