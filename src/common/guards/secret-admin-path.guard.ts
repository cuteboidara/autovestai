import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RequestLike = {
  originalUrl?: string;
  url?: string;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
};

const ADMIN_PROTECTED_PREFIXES = ['/admin', '/crm'];

function normalizeRequestPath(request: RequestLike): string {
  const rawPath =
    request.path ??
    request.originalUrl?.split('?')[0] ??
    request.url?.split('?')[0] ??
    '/';

  return rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
}

function isProtectedAdminPath(pathname: string): boolean {
  return ADMIN_PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

@Injectable()
export class SecretAdminPathGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType<'http' | 'ws'>() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestLike>();
    const pathname = normalizeRequestPath(request);

    if (!isProtectedAdminPath(pathname)) {
      return true;
    }

    const configuredPath =
      this.configService.get<string>('app.adminPath') ?? 'control-tower';
    const headerValue = request.headers?.['x-admin-path'];
    const providedPath = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (providedPath?.trim() !== configuredPath) {
      // FIX: Return a 404 for admin-only endpoints when the secret route header
      // is missing or incorrect so direct probing of /admin stays indistinguishable
      // from an unknown route.
      throw new NotFoundException();
    }

    return true;
  }
}
