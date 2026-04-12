export const ADMIN_CHAT_CHANNELS = ['general', 'compliance', 'risk'] as const;

export type AdminChatChannel = (typeof ADMIN_CHAT_CHANNELS)[number];
