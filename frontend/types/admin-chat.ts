export interface AdminChatMessage {
  id: string;
  authorId: string | null;
  content: string;
  channel: 'general' | 'compliance' | 'risk';
  isSystem: boolean;
  createdAt: string;
  readBy: string[];
  author?: {
    id: string;
    email: string;
    accountNumber?: string;
    displayName: string;
  } | null;
}

export interface AdminChatUnreadCounts {
  general: number;
  compliance: number;
  risk: number;
}

export interface OnlineAdminUser {
  id: string;
  email: string;
  accountNumber?: string;
  displayName: string;
}
