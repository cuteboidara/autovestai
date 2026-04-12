'use client';

import { create } from 'zustand';

import { PlatformStatus } from '@/types/platform';

interface PlatformState {
  status: PlatformStatus | null;
  setStatus: (status: PlatformStatus | null) => void;
}

export const usePlatformStore = create<PlatformState>((set) => ({
  status: null,
  setStatus(status) {
    set({ status });
  },
}));
