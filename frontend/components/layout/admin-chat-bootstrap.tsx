'use client';

import { useEffect } from 'react';

import { adminChatSocketManager } from '@/lib/admin-chat-socket-manager';
import { adminChatApi } from '@/services/api/admin-chat';
import { useAuthStore } from '@/store/auth-store';
import { useAdminChatStore } from '@/store/admin-chat-store';
import { AdminChatMessage } from '@/types/admin-chat';

export function AdminChatBootstrap() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUnreadCounts = useAdminChatStore((state) => state.setUnreadCounts);
  const receiveMessage = useAdminChatStore((state) => state.receiveMessage);

  useEffect(() => {
    if (
      !token ||
      user?.role !== 'ADMIN' ||
      !user.permissions.includes('chat.view')
    ) {
      return;
    }

    let active = true;
    adminChatSocketManager.connect(token);

    void adminChatApi.listUnreadCounts().then((counts) => {
      if (active) {
        setUnreadCounts(counts);
      }
    });

    const dispose = adminChatSocketManager.on('admin_message', (payload) => {
      receiveMessage(payload as AdminChatMessage);
    });

    return () => {
      active = false;
      dispose();
      adminChatSocketManager.disconnect();
    };
  }, [receiveMessage, setUnreadCounts, token, user?.permissions, user?.role]);

  return null;
}
