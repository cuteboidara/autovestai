'use client';

import { create } from 'zustand';

import { PlatformStatus, PlatformSymbolHealth } from '@/types/platform';

interface PlatformState {
  status: PlatformStatus | null;
  setStatus: (status: PlatformStatus | null) => void;
  upsertSymbolHealth: (health: PlatformSymbolHealth) => void;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  status: null,
  setStatus(status) {
    set({ status });
  },
  upsertSymbolHealth(health) {
    set((state) => {
      if (!state.status) {
        return state;
      }

      return {
        status: {
          ...state.status,
          symbolHealth: {
            ...state.status.symbolHealth,
            [health.symbol]: health,
          },
          timestamp: new Date().toISOString(),
        },
      };
    });
  },
}));
