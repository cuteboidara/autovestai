'use client';

import { create } from 'zustand';

import { PositionRecord } from '@/types/trading';

interface PositionsState {
  positions: PositionRecord[];
  setPositions: (positions: PositionRecord[]) => void;
  upsertPosition: (position: PositionRecord) => void;
  mergePositions: (positions: PositionRecord[]) => void;
}

export const usePositionsStore = create<PositionsState>((set) => ({
  positions: [],
  setPositions(positions) {
    set({ positions: Array.isArray(positions) ? positions : [] });
  },
  upsertPosition(position) {
    set((state) => ({
      positions: [
        position,
        ...(Array.isArray(state.positions) ? state.positions : []).filter(
          (entry) => entry.id !== position.id,
        ),
      ],
    }));
  },
  mergePositions(positions) {
    set((state) => {
      if (!Array.isArray(positions) || positions.length === 0) {
        return { positions: Array.isArray(state.positions) ? state.positions : [] };
      }

      const next = Array.isArray(state.positions) ? [...state.positions] : [];

      for (const position of positions) {
        const index = next.findIndex((entry) => entry.id === position.id);

        if (index === -1) {
          next.unshift(position);
        } else {
          next[index] = position;
        }
      }

      return { positions: next };
    });
  },
}));
