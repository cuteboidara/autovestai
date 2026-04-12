import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

import {
  RESPONSE_CACHE_RESOURCE_METADATA,
  RESPONSE_CACHE_SCOPE_METADATA,
  RESPONSE_CACHE_TTL_METADATA,
  ResponseCacheScope,
} from './cache.constants';
import { ResponseCacheService } from './response-cache.service';

@Injectable()
export class ResponseCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly responseCacheService: ResponseCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
      user?: { id?: string };
    }>();
    const ttlSeconds = this.reflector.getAllAndOverride<number>(
      RESPONSE_CACHE_TTL_METADATA,
      [context.getHandler(), context.getClass()],
    );
    const resource = this.reflector.getAllAndOverride<string>(
      RESPONSE_CACHE_RESOURCE_METADATA,
      [context.getHandler(), context.getClass()],
    );
    const scope =
      this.reflector.getAllAndOverride<ResponseCacheScope>(
        RESPONSE_CACHE_SCOPE_METADATA,
        [context.getHandler(), context.getClass()],
      ) ?? 'public';

    if (request.method !== 'GET' || !ttlSeconds || !resource) {
      return next.handle();
    }

    const cacheKey = this.buildCacheKey({
      resource,
      scope,
      userId: request.user?.id ?? 'anonymous',
      params: request.params ?? {},
      query: request.query ?? {},
    });

    return from(this.responseCacheService.get(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached !== null) {
          return of(cached);
        }

        return next.handle().pipe(
          tap((value) => {
            void this.responseCacheService.set(cacheKey, value, ttlSeconds);
          }),
        );
      }),
    );
  }

  private buildCacheKey(params: {
    resource: string;
    scope: ResponseCacheScope;
    userId: string;
    params: Record<string, unknown>;
    query: Record<string, unknown>;
  }) {
    const keyParts = ['response-cache', params.resource];

    if (params.scope === 'public') {
      keyParts.push('public');
    } else if (params.scope === 'user') {
      keyParts.push('user', params.userId);
    } else {
      const accountId = this.readString(params.query.accountId) ?? 'default';
      keyParts.push('user', params.userId, 'account', accountId);
    }

    keyParts.push(
      'params',
      this.encodeSegment(this.normalize(params.params)),
      'query',
      this.encodeSegment(this.normalize(params.query)),
    );

    return keyParts.join(':');
  }

  private normalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.normalize(entry));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = this.normalize((value as Record<string, unknown>)[key]);
          return result;
        }, {});
    }

    return value ?? null;
  }

  private encodeSegment(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
