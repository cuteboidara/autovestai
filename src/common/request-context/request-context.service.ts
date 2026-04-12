import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextStore>();

  run<T>(store: RequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  get(): RequestContextStore | undefined {
    return this.storage.getStore();
  }
}
