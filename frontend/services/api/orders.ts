import { OrderRecord, PlaceOrderRequest } from '@/types/trading';

import { apiRequest } from './http';

export const ordersApi = {
  list(query?: string) {
    return apiRequest<OrderRecord[]>(`/orders${query ? `?${query}` : ''}`);
  },
  place(payload: PlaceOrderRequest) {
    return apiRequest<unknown>('/orders', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
};
