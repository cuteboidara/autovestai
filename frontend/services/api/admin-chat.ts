import {
  AdminChatMessage,
  AdminChatUnreadCounts,
  OnlineAdminUser,
} from '@/types/admin-chat';

import { apiRequest } from './http';

export const adminChatApi = {
  listUnreadCounts() {
    return apiRequest<AdminChatUnreadCounts>('/admin/chat/unread-counts');
  },
  listOnlineAdmins() {
    return apiRequest<OnlineAdminUser[]>('/admin/chat/online-admins');
  },
  listMessages(channel: 'general' | 'compliance' | 'risk') {
    return apiRequest<AdminChatMessage[]>(`/admin/chat/${channel}`);
  },
  postMessage(channel: 'general' | 'compliance' | 'risk', content: string) {
    return apiRequest<AdminChatMessage>(`/admin/chat/${channel}`, {
      method: 'POST',
      body: { content },
      retry: false,
    });
  },
};
