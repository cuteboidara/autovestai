import { PlatformStatus } from '@/types/platform';

import { apiRequest } from './http';

export const platformApi = {
  getStatus() {
    return apiRequest<PlatformStatus>('/platform/status', {
      authMode: 'none',
    });
  },
};
