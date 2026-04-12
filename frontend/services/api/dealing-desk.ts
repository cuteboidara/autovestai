import { AdminExposure, HedgeAction } from '@/types/admin';

import { apiRequest } from './http';

export const dealingDeskApi = {
  getExposure() {
    return apiRequest<AdminExposure[]>('/dealing-desk/exposure');
  },
  getExposureBySymbol(symbol: string) {
    return apiRequest<AdminExposure>(`/dealing-desk/exposure/${symbol}`);
  },
  getHedgeActions() {
    return apiRequest<HedgeAction[]>('/dealing-desk/hedge-actions');
  },
  approveHedgeAction(id: string, reason?: string) {
    return apiRequest<HedgeAction>(`/dealing-desk/hedge-actions/${id}/approve`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
  rejectHedgeAction(id: string, reason?: string) {
    return apiRequest<HedgeAction>(`/dealing-desk/hedge-actions/${id}/reject`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
};
