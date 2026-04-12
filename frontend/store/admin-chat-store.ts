'use client';

import { create } from 'zustand';

import { AdminChatMessage, AdminChatUnreadCounts } from '@/types/admin-chat';

interface AdminChatState {
  unreadCounts: AdminChatUnreadCounts;
  activeChannel: 'general' | 'compliance' | 'risk' | null;
  setUnreadCounts: (counts: Partial<AdminChatUnreadCounts>) => void;
  setActiveChannel: (channel: 'general' | 'compliance' | 'risk' | null) => void;
  clearUnreadForChannel: (channel: 'general' | 'compliance' | 'risk') => void;
  receiveMessage: (message: AdminChatMessage) => void;
}

const emptyUnreadCounts: AdminChatUnreadCounts = {
  general: 0,
  compliance: 0,
  risk: 0,
};

export const useAdminChatStore = create<AdminChatState>()((set, get) => ({
  unreadCounts: emptyUnreadCounts,
  activeChannel: null,
  setUnreadCounts(counts) {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        ...counts,
      },
    }));
  },
  setActiveChannel(channel) {
    set({ activeChannel: channel });
  },
  clearUnreadForChannel(channel) {
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channel]: 0,
      },
    }));
  },
  receiveMessage(message) {
    const { activeChannel } = get();

    if (activeChannel === message.channel) {
      return;
    }

    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [message.channel]: (state.unreadCounts[message.channel] ?? 0) + 1,
      },
    }));
  },
}));
