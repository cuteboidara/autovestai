'use client';

import { create } from 'zustand';

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface NotificationState {
  items: NotificationItem[];
  push: (item: Omit<NotificationItem, 'id'>) => void;
  remove: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  push(item) {
    const id = crypto.randomUUID();
    set((state) => ({
      items: [...state.items, { ...item, id }],
    }));

    setTimeout(() => {
      set((state) => ({
        items: state.items.filter((entry) => entry.id !== id),
      }));
    }, 4000);
  },
  remove(id) {
    set((state) => ({
      items: state.items.filter((entry) => entry.id !== id),
    }));
  },
}));
