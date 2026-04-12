'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { adminChatSocketManager } from '@/lib/admin-chat-socket-manager';
import { formatDateTime } from '@/lib/utils';
import { adminChatApi } from '@/services/api/admin-chat';
import { useAdminChatStore } from '@/store/admin-chat-store';
import { useNotificationStore } from '@/store/notification-store';
import { AdminChatMessage, OnlineAdminUser } from '@/types/admin-chat';

type ChatChannel = 'general' | 'compliance' | 'risk';

const channels: Array<{ value: ChatChannel; label: string }> = [
  { value: 'general', label: '#general' },
  { value: 'compliance', label: '#compliance' },
  { value: 'risk', label: '#risk' },
];

function getInitials(value: string | null | undefined) {
  if (!value?.trim()) {
    return 'NA';
  }

  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function getDayKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export default function AdminChatPage() {
  const { hasPermission, user: authUser } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const unreadCounts = useAdminChatStore((state) => state.unreadCounts);
  const clearUnreadForChannel = useAdminChatStore((state) => state.clearUnreadForChannel);
  const setActiveChannel = useAdminChatStore((state) => state.setActiveChannel);
  const [activeChannel, setLocalActiveChannel] = useState<ChatChannel>('general');
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [onlineAdmins, setOnlineAdmins] = useState<OnlineAdminUser[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const canViewChat = hasPermission('chat.view');

  async function loadMessages(channel: ChatChannel) {
    const response = await adminChatApi.listMessages(channel);
    setMessages(response);
    clearUnreadForChannel(channel);
  }

  async function loadOnlineAdmins() {
    const response = await adminChatApi.listOnlineAdmins();
    setOnlineAdmins(response);
  }

  useEffect(() => {
    if (!canViewChat) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    void Promise.all([loadMessages(activeChannel), loadOnlineAdmins()])
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load admin chat',
          description: error instanceof Error ? error.message : 'Request failed',
          type: 'error',
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activeChannel, canViewChat, clearUnreadForChannel, pushNotification]);

  useEffect(() => {
    if (!canViewChat) {
      return;
    }

    setActiveChannel(activeChannel);
    clearUnreadForChannel(activeChannel);

    return () => {
      setActiveChannel(null);
    };
  }, [activeChannel, canViewChat, clearUnreadForChannel, setActiveChannel]);

  useEffect(() => {
    if (!canViewChat) {
      return;
    }

    const disposeMessage = adminChatSocketManager.on('admin_message', (payload) => {
      const message = payload as AdminChatMessage;

      if (message.channel !== activeChannel) {
        return;
      }

      setMessages((current) =>
        current.some((entry) => entry.id === message.id) ? current : [...current, message],
      );
    });
    const disposeConnect = adminChatSocketManager.on('connect', () => {
      void loadOnlineAdmins();
      void loadMessages(activeChannel);
    });
    const disposeDisconnect = adminChatSocketManager.on('disconnect', () => {
      void loadOnlineAdmins();
    });

    return () => {
      disposeMessage();
      disposeConnect();
      disposeDisconnect();
    };
  }, [activeChannel, canViewChat]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const groupedMessages = useMemo(() => {
    const grouped = new Map<string, AdminChatMessage[]>();

    for (const message of messages) {
      const dayKey = getDayKey(message.createdAt);
      const bucket = grouped.get(dayKey) ?? [];
      bucket.push(message);
      grouped.set(dayKey, bucket);
    }

    return Array.from(grouped.entries());
  }, [messages]);

  async function handleSend() {
    if (!canViewChat || !draft.trim()) {
      return;
    }

    setSending(true);

    try {
      await adminChatApi.postMessage(activeChannel, draft.trim());
      setDraft('');
    } catch (error) {
      pushNotification({
        title: 'Unable to send message',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  }

  if (!canViewChat) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Communication"
          title="Internal Chat"
          description="Real-time internal chat for the operations, compliance, and risk teams."
        />
        <PermissionDenied
          title="Internal chat unavailable"
          description="This admin account does not have permission to access internal chat."
          requiredPermission="chat.view"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communication"
        title="Internal Chat"
        description="Real-time internal chat for the operations, compliance, and risk teams."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Panel title="Channels" description="Switch channels and monitor unread counts.">
          <div className="space-y-6">
            <div className="space-y-2">
              {channels.map((channel) => {
                const unread = unreadCounts[channel.value];
                const active = activeChannel === channel.value;

                return (
                  <button
                    key={channel.value}
                    type="button"
                    onClick={() => setLocalActiveChannel(channel.value)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
                      active ? 'bg-[#0F172A] text-white' : 'bg-page text-primary hover:bg-surface'
                    }`}
                  >
                    <span>{channel.label}</span>
                    {unread > 0 ? (
                      <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${active ? 'bg-white/10 text-white' : 'bg-amber-100 text-amber-700'}`}>
                        {unread}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <p className="label-eyebrow">Online admins</p>
              {onlineAdmins.length === 0 ? (
                <p className="text-sm text-secondary">No active admin sessions detected.</p>
              ) : (
                onlineAdmins.map((admin) => (
                  <div key={admin.id} className="flex items-center gap-3 rounded-2xl border border-border bg-page px-4 py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F172A] text-xs font-semibold text-white">
                      {getInitials(admin.displayName ?? admin.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-primary">
                        {admin.displayName}
                      </p>
                      <p className="truncate text-xs text-secondary">{admin.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title={channels.find((channel) => channel.value === activeChannel)?.label ?? '#general'}
          description="Messages are broadcast live to connected admin sessions in the active channel."
        >
          {loading ? (
            <p className="text-sm text-secondary">Loading admin messages...</p>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[60vh] space-y-4 overflow-y-auto rounded-3xl border border-border bg-page p-4">
                {groupedMessages.length === 0 ? (
                  <p className="text-sm text-secondary">No messages in this channel yet.</p>
                ) : (
                  groupedMessages.map(([dayKey, dayMessages]) => (
                    <div key={dayKey} className="space-y-3">
                      <div className="sticky top-0 z-[1] flex justify-center">
                        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-secondary">
                          {dayKey}
                        </span>
                      </div>
                      {dayMessages.map((message) => {
                        const isOwnMessage = message.authorId === authUser?.id;

                        return (
                          <div
                            key={message.id}
                            className={`rounded-3xl border px-4 py-4 ${
                              message.isSystem
                                ? 'border-border bg-surface'
                                : isOwnMessage
                                  ? 'border-accent/25 bg-accent/10'
                                  : 'border-border bg-page'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F172A] text-xs font-semibold text-white">
                                {message.isSystem
                                  ? 'SYS'
                                  : getInitials(message.author?.displayName ?? message.author?.email)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-primary">
                                    {message.isSystem
                                      ? 'System'
                                      : message.author?.displayName ?? message.author?.email ?? 'Admin'}
                                  </p>
                                  {message.isSystem ? <StatusBadge value="SYSTEM" /> : null}
                                  <p className="text-xs text-secondary">
                                    {formatDateTime(message.createdAt)}
                                  </p>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-primary">
                                  {message.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
                <div ref={messageEndRef} />
              </div>

              <div className="space-y-3 rounded-3xl border border-border bg-page p-4">
                <Textarea
                  label="Message"
                  rows={4}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Message ${channels.find((channel) => channel.value === activeChannel)?.label}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <div className="flex justify-end">
                  <Button disabled={sending || !draft.trim()} onClick={() => void handleSend()}>
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
