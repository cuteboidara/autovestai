'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { PermissionDenied } from '@/components/auth/permission-denied';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { adminRoute } from '@/lib/admin-route';
import { formatDateTime } from '@/lib/utils';
import { crmApi } from '@/services/api/crm';
import { useNotificationStore } from '@/store/notification-store';
import { CrmClientListItem, CrmEmailLog, CrmEmailSenderConfig, CrmEmailTemplate } from '@/types/crm';

type EmailTab = 'compose' | 'history' | 'templates';

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

export default function CrmEmailCenterPage() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const pushNotification = useNotificationStore((state) => state.push);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<EmailTab>('compose');
  const [clients, setClients] = useState<CrmClientListItem[]>([]);
  const [senders, setSenders] = useState<CrmEmailSenderConfig[]>([]);
  const [templates, setTemplates] = useState<CrmEmailTemplate[]>([]);
  const [logs, setLogs] = useState<CrmEmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [allClients, setAllClients] = useState(false);
  const [senderConfigId, setSenderConfigId] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const canSendEmail = hasPermission('email.send');
  const canManageSenders = hasPermission('email.settings');

  async function loadData() {
    const [clientResponse, senderResponse, templateResponse, logResponse] = await Promise.all([
      crmApi.listClients({ limit: 200, sortBy: 'registration_date', sortOrder: 'desc' }),
      crmApi.listSenders(),
      crmApi.listTemplates(),
      crmApi.listEmailLogs(),
    ]);

    setClients(clientResponse.items);
    setSenders(senderResponse);
    setTemplates(templateResponse);
    setLogs(logResponse);
    setSenderConfigId((current) => {
      if (current) {
        return current;
      }

      return senderResponse.find((sender) => sender.isDefault)?.id ?? senderResponse[0]?.id ?? '';
    });
  }

  useEffect(() => {
    if (!canSendEmail) {
      return;
    }

    let active = true;

    setLoading(true);
    void loadData()
      .catch((error) => {
        if (!active) {
          return;
        }

        pushNotification({
          title: 'Unable to load CRM email center',
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
  }, [canSendEmail, pushNotification]);

  useEffect(() => {
    const param = searchParams.get('userIds');

    if (!param) {
      return;
    }

    setSelectedUserIds(
      Array.from(
        new Set(
          param
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ),
    );
  }, [searchParams]);

  if (!canSendEmail) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="CRM / Email"
          title="Email Center"
          description="Compose manual or bulk CRM emails, review delivery history, and manage reusable templates."
        />
        <PermissionDenied
          title="Email center unavailable"
          description="This admin account does not have permission to send CRM emails."
          requiredPermission="email.send"
        />
      </div>
    );
  }

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== bodyHtml) {
      editorRef.current.innerHTML = bodyHtml;
    }
  }, [bodyHtml]);

  const filteredClients = useMemo(() => {
    const search = recipientSearch.trim().toLowerCase();

    if (!search) {
      return clients.slice(0, 20);
    }

    return clients
      .filter((client) =>
        [client.accountNumber, client.email, client.fullName ?? '']
          .join(' ')
          .toLowerCase()
          .includes(search),
      )
      .slice(0, 20);
  }, [clients, recipientSearch]);

  const selectedClients = useMemo(
    () => clients.filter((client) => selectedUserIds.includes(client.id)),
    [clients, selectedUserIds],
  );

  function toggleRecipient(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function syncEditorBody() {
    setBodyHtml(editorRef.current?.innerHTML ?? '');
  }

  function applyEditorCommand(command: string) {
    editorRef.current?.focus();

    if (command === 'createLink') {
      const url = window.prompt('Enter the link URL');

      if (!url?.trim()) {
        return;
      }

      document.execCommand(command, false, url.trim());
    } else {
      document.execCommand(command, false);
    }

    syncEditorBody();
  }

  function loadTemplate(template: CrmEmailTemplate, editMode: boolean) {
    setSubject(template.subject);
    setBodyHtml(template.body);
    setEditingTemplateId(editMode ? template.id : null);
    setActiveTab('compose');
  }

  async function handleSendEmail() {
    if (!senderConfigId || !subject.trim() || !bodyHtml.trim()) {
      pushNotification({
        title: 'Missing email fields',
        description: 'From, subject, and body are required before sending.',
        type: 'error',
      });
      return;
    }

    if (!allClients && selectedUserIds.length === 0) {
      pushNotification({
        title: 'No recipients selected',
        description: 'Choose one or more clients, or enable broadcast to all clients.',
        type: 'error',
      });
      return;
    }

    setSending(true);

    try {
      const response = await crmApi.sendEmail({
        senderConfigId,
        subject: subject.trim(),
        body: bodyHtml,
        userIds: allClients ? undefined : selectedUserIds,
        allClients,
      });

      pushNotification({
        title: 'Email dispatch completed',
        description: `${response.sent} sent, ${response.failed} failed.`,
        type: response.failed > 0 ? 'warning' : 'success',
      });
      await loadData();
      setActiveTab('history');
    } catch (error) {
      pushNotification({
        title: 'Email dispatch failed',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSending(false);
    }
  }

  async function handleSaveTemplate() {
    if (!subject.trim() || !bodyHtml.trim()) {
      pushNotification({
        title: 'Template incomplete',
        description: 'Add a subject and body before saving a template.',
        type: 'error',
      });
      return;
    }

    const currentTemplate = templates.find((template) => template.id === editingTemplateId);
    const templateName = window.prompt(
      'Template name',
      currentTemplate?.name ?? `${subject.trim().slice(0, 40) || 'CRM template'}`,
    );

    if (!templateName?.trim()) {
      return;
    }

    setSavingTemplate(true);

    try {
      if (editingTemplateId) {
        await crmApi.updateTemplate(editingTemplateId, {
          name: templateName.trim(),
          subject: subject.trim(),
          body: bodyHtml,
        });
      } else {
        await crmApi.createTemplate({
          name: templateName.trim(),
          subject: subject.trim(),
          body: bodyHtml,
        });
      }

      await loadData();
      pushNotification({
        title: editingTemplateId ? 'Template updated' : 'Template saved',
        description: `${templateName.trim()} is ready to reuse.`,
        type: 'success',
      });
      setEditingTemplateId(null);
      setActiveTab('templates');
    } catch (error) {
      pushNotification({
        title: 'Unable to save template',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!window.confirm('Delete this email template?')) {
      return;
    }

    try {
      await crmApi.deleteTemplate(templateId);
      await loadData();
      pushNotification({
        title: 'Template deleted',
        description: 'The CRM email template has been removed.',
        type: 'success',
      });
    } catch (error) {
      pushNotification({
        title: 'Unable to delete template',
        description: error instanceof Error ? error.message : 'Request failed',
        type: 'error',
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CRM / Email"
        title="Email Center"
        description="Compose manual or bulk emails, review send history, and manage reusable CRM templates."
        actions={
          <div className="inline-flex rounded-xl border border-border bg-page p-1">
            {[
              { value: 'compose', label: 'Compose' },
              { value: 'history', label: 'Sent History' },
              { value: 'templates', label: 'Templates' },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value as EmailTab)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  activeTab === tab.value
                    ? 'bg-surface text-primary shadow-sm'
                    : 'text-secondary hover:text-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {loading ? (
        <Panel>
          <p className="text-sm text-secondary">Loading CRM email data...</p>
        </Panel>
      ) : null}

      {!loading && activeTab === 'compose' ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="Recipients" description="Search clients by account number, name, or email and build a recipient list.">
            <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-2xl border border-border bg-page px-4 py-3 text-sm text-primary">
                <input
                  type="checkbox"
                  checked={allClients}
                  onChange={(event) => setAllClients(event.target.checked)}
                />
                <span>Broadcast to all clients</span>
              </label>

              <Input
                label="Search recipients"
                value={recipientSearch}
                onChange={(event) => setRecipientSearch(event.target.value)}
                placeholder="Search by account number, name, or email"
                disabled={allClients}
              />

              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <label
                    key={client.id}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-page px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(client.id)}
                      onChange={() => toggleRecipient(client.id)}
                      disabled={allClients}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-primary">
                        {client.fullName ?? client.email}
                      </p>
                      <p className="mt-1 truncate text-secondary">
                        {client.accountNumber} • {client.email}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <p className="label-eyebrow">Selected recipients</p>
                {allClients ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    All clients will receive this email.
                  </div>
                ) : selectedClients.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => toggleRecipient(client.id)}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-primary"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0F172A] text-[10px] text-white">
                          {getInitials(client.fullName ?? client.email)}
                        </span>
                        <span>{client.accountNumber}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-secondary">No specific clients selected yet.</p>
                )}
              </div>
            </div>
          </Panel>

          <Panel
            title="Compose"
            description="Use a configured sender, optional saved template, and a rich-text editor for CRM outreach."
            actions={
              senders.length === 0 ? (
                <Button asChild variant="secondary">
                  {canManageSenders ? (
                    <Link href={adminRoute('/crm/settings/email-senders')}>
                      Configure Senders
                    </Link>
                  ) : (
                    'No active sender is configured.'
                  )}
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="From"
                  value={senderConfigId}
                  onChange={(event) => setSenderConfigId(event.target.value)}
                >
                  <option value="">Select sender</option>
                  {senders.map((sender) => (
                    <option key={sender.id} value={sender.id}>
                      {sender.name} ({sender.fromEmail}){sender.isDefault ? ' • default' : ''}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Template"
                  value=""
                  onChange={(event) => {
                    const template = templates.find((entry) => entry.id === event.target.value);
                    if (template) {
                      loadTemplate(template, false);
                    }
                  }}
                >
                  <option value="">Optional template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </div>

              <Input
                label="Subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Enter email subject"
              />

              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => applyEditorCommand('bold')}>
                    Bold
                  </Button>
                  <Button variant="secondary" onClick={() => applyEditorCommand('italic')}>
                    Italic
                  </Button>
                  <Button variant="secondary" onClick={() => applyEditorCommand('insertUnorderedList')}>
                    Bullet List
                  </Button>
                  <Button variant="secondary" onClick={() => applyEditorCommand('createLink')}>
                    Link
                  </Button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncEditorBody}
                  className="min-h-64 rounded-2xl border border-border bg-page px-4 py-4 text-sm text-primary outline-none focus:border-accent"
                />
                {editingTemplateId ? (
                  <p className="text-xs text-secondary">
                    Editing template: {templates.find((template) => template.id === editingTemplateId)?.name}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="secondary" disabled={savingTemplate} onClick={() => void handleSaveTemplate()}>
                  {savingTemplate
                    ? 'Saving...'
                    : editingTemplateId
                      ? 'Update Template'
                      : 'Save as Template'}
                </Button>
                <Button disabled={sending || senders.length === 0} onClick={() => void handleSendEmail()}>
                  {sending ? 'Sending...' : 'Send Email'}
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}

      {!loading && activeTab === 'history' ? (
        <Panel title="Sent History" description="Full CRM email log with subject, sender, delivery status, and body preview.">
          <div className="space-y-3">
            {logs.length === 0 ? (
              <p className="text-sm text-secondary">No emails have been sent yet.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="rounded-3xl border border-border bg-page p-4">
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-start justify-between gap-3 text-left"
                    onClick={() =>
                      setExpandedLogId((current) => (current === log.id ? null : log.id))
                    }
                  >
                    <div>
                      <p className="font-medium text-primary">{log.subject}</p>
                      <p className="mt-1 text-sm text-secondary">
                        To {log.toUser?.accountNumber ?? log.toUser?.email ?? log.toUserId} • From {log.fromEmail} • {formatDateTime(log.sentAt)}
                      </p>
                    </div>
                    <StatusBadge value={log.status} />
                  </button>
                  {expandedLogId === log.id ? (
                    <div className="mt-4 rounded-2xl border border-border bg-white p-4">
                      <div
                        className="prose prose-sm max-w-none text-primary"
                        dangerouslySetInnerHTML={{ __html: log.body }}
                      />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Panel>
      ) : null}

      {!loading && activeTab === 'templates' ? (
        <Panel title="Templates" description="Reusable templates for support, compliance, and marketing-style CRM outreach.">
          <div className="space-y-3">
            {templates.length === 0 ? (
              <p className="text-sm text-secondary">No email templates saved yet.</p>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="rounded-3xl border border-border bg-page p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-primary">{template.name}</p>
                      <p className="mt-1 text-sm text-secondary">{template.subject}</p>
                      <p className="mt-2 text-xs text-secondary">
                        Created {formatDateTime(template.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => loadTemplate(template, false)}>
                        Use
                      </Button>
                      <Button variant="secondary" onClick={() => loadTemplate(template, true)}>
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => void handleDeleteTemplate(template.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
