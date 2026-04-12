import {
  CrmClientListResponse,
  CrmClientNote,
  CrmClientProfile,
  CrmEmailLog,
  CrmEmailSendResponse,
  CrmEmailSenderConfig,
  CrmEmailTemplate,
} from '@/types/crm';

import { apiRequest } from './http';

export const crmApi = {
  listClients(query?: Record<string, string | number | undefined>) {
    const queryString = query
      ? new URLSearchParams(
          Object.entries(query)
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([key, value]) => [key, String(value)]),
        ).toString()
      : '';

    return apiRequest<CrmClientListResponse>(`/crm/clients${queryString ? `?${queryString}` : ''}`);
  },
  getClientProfile(accountNumber: string) {
    return apiRequest<CrmClientProfile>(`/crm/clients/${accountNumber}`);
  },
  listNotes(clientId: string) {
    return apiRequest<CrmClientNote[]>(`/crm/clients/${clientId}/notes`);
  },
  addNote(clientId: string, payload: { noteType: string; content: string }) {
    return apiRequest<CrmClientNote>(`/crm/clients/${clientId}/notes`, {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  updateNote(
    clientId: string,
    noteId: string,
    payload: Partial<{ noteType: string; content: string }>,
  ) {
    return apiRequest<CrmClientNote>(`/crm/clients/${clientId}/notes/${noteId}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  deleteNote(clientId: string, noteId: string) {
    return apiRequest<{ success: boolean }>(`/crm/clients/${clientId}/notes/${noteId}`, {
      method: 'DELETE',
      retry: false,
    });
  },
  sendEmail(payload: {
    userIds?: string[];
    allClients?: boolean;
    templateId?: string;
    senderConfigId?: string;
    subject?: string;
    body?: string;
  }) {
    return apiRequest<CrmEmailSendResponse>('/crm/email/send', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  listEmailLogs() {
    return apiRequest<CrmEmailLog[]>('/crm/email/logs');
  },
  listClientEmailLogs(clientId: string) {
    return apiRequest<CrmEmailLog[]>(`/crm/email/logs/${clientId}`);
  },
  createTemplate(payload: { name: string; subject: string; body: string }) {
    return apiRequest<CrmEmailTemplate>('/crm/email/templates', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  listTemplates() {
    return apiRequest<CrmEmailTemplate[]>('/crm/email/templates');
  },
  updateTemplate(templateId: string, payload: Partial<{ name: string; subject: string; body: string }>) {
    return apiRequest<CrmEmailTemplate>(`/crm/email/templates/${templateId}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  deleteTemplate(templateId: string) {
    return apiRequest<{ success: boolean }>(`/crm/email/templates/${templateId}`, {
      method: 'DELETE',
      retry: false,
    });
  },
  listSenders() {
    return apiRequest<CrmEmailSenderConfig[]>('/crm/email/senders');
  },
  createSender(payload: {
    name: string;
    fromEmail: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    return apiRequest<CrmEmailSenderConfig>('/crm/email/senders', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  updateSender(
    senderId: string,
    payload: Partial<{
      name: string;
      fromEmail: string;
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      isDefault: boolean;
      isActive: boolean;
    }>,
  ) {
    return apiRequest<CrmEmailSenderConfig>(`/crm/email/senders/${senderId}`, {
      method: 'PATCH',
      body: payload,
      retry: false,
    });
  },
  deleteSender(senderId: string) {
    return apiRequest<{ success: boolean }>(`/crm/email/senders/${senderId}`, {
      method: 'DELETE',
      retry: false,
    });
  },
  testSender(senderId: string) {
    return apiRequest<{ success: boolean }>(`/crm/email/senders/${senderId}/test`, {
      method: 'POST',
      retry: false,
    });
  },
};
