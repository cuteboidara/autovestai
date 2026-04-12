const normalizedAdminPath =
  process.env.NEXT_PUBLIC_ADMIN_PATH?.trim().replace(/^\/+|\/+$/g, '') ||
  'control-tower';

export const ADMIN_PATH_SEGMENT = normalizedAdminPath;

export function adminRoute(path = ''): string {
  if (!path || path === '/') {
    return `/${ADMIN_PATH_SEGMENT}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `/${ADMIN_PATH_SEGMENT}${normalizedPath}`;
}

export function isAdminScopedApiPath(path: string): boolean {
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/crm' ||
    path.startsWith('/crm/')
  );
}
