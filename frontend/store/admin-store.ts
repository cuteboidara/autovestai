'use client';

import { create } from 'zustand';

import { AdminExposure, HedgeAction } from '@/types/admin';

interface AdminState {
  exposure: AdminExposure[];
  hedgeActions: HedgeAction[];
  websocketConnected: boolean;
  setExposure: (items: AdminExposure[]) => void;
  upsertExposure: (item: AdminExposure) => void;
  setHedgeActions: (items: HedgeAction[]) => void;
  upsertHedgeAction: (item: HedgeAction) => void;
  setWebsocketConnected: (value: boolean) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  exposure: [],
  hedgeActions: [],
  websocketConnected: false,
  setExposure(items) {
    set({ exposure: items });
  },
  upsertExposure(item) {
    set((state) => ({
      exposure: [item, ...state.exposure.filter((entry) => entry.symbol !== item.symbol)],
    }));
  },
  setHedgeActions(items) {
    set({ hedgeActions: items });
  },
  upsertHedgeAction(item) {
    set((state) => ({
      hedgeActions: [item, ...state.hedgeActions.filter((entry) => entry.id !== item.id)],
    }));
  },
  setWebsocketConnected(value) {
    set({ websocketConnected: value });
  },
}));
