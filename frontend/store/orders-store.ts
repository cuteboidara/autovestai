'use client';

import { create } from 'zustand';

import { OrderRecord } from '@/types/trading';

interface OrdersState {
  orders: OrderRecord[];
  setOrders: (orders: OrderRecord[]) => void;
  upsertOrder: (order: OrderRecord) => void;
}

export const useOrdersStore = create<OrdersState>((set) => ({
  orders: [],
  setOrders(orders) {
    set({ orders: Array.isArray(orders) ? orders : [] });
  },
  upsertOrder(order) {
    set((state) => ({
      orders: [
        order,
        ...(Array.isArray(state.orders) ? state.orders : []).filter(
          (entry) => entry.id !== order.id,
        ),
      ],
    }));
  },
}));
