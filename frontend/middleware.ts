import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_PATH =
  process.env.ADMIN_PATH?.trim().replace(/^\/+|\/+$/g, '') || 'control-tower';

function isBlockedAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function isSecretAdminPath(pathname: string): boolean {
  return pathname === `/${ADMIN_PATH}` || pathname.startsWith(`/${ADMIN_PATH}/`);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isBlockedAdminPath(pathname)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
    });
  }

  if (pathname === `/${ADMIN_PATH}/login`) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.rewrite(url);
  }

  if (isSecretAdminPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(`/${ADMIN_PATH}`, '/admin') || '/admin';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};
