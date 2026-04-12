import { KycSubmission } from '@/types/kyc';

import { apiRequest } from './http';

export const kycApi = {
  upload(file: File, kind: string, label?: string) {
    const body = new FormData();
    body.append('file', file);
    body.append('kind', kind);

    if (label) {
      body.append('label', label);
    }

    return apiRequest<{
      url: string;
      kind: string;
      label?: string;
      mimeType: string;
      originalName: string;
    }>('/kyc/upload', {
      method: 'POST',
      body,
      retry: false,
    });
  },
  submit(payload: Record<string, unknown>) {
    return apiRequest<KycSubmission>('/kyc/submit', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  getMine() {
    return apiRequest<KycSubmission>('/kyc/me');
  },
  listAdmin() {
    return apiRequest<Array<KycSubmission & { user: { id: string; email: string } }>>(
      '/admin/kyc',
    );
  },
  getAdminDetail(id: string) {
    return apiRequest<KycSubmission & { user: { id: string; email: string } }>(
      `/admin/kyc/${id}`,
    );
  },
  approve(id: string, reason?: string) {
    return apiRequest<KycSubmission>(`/admin/kyc/${id}/approve`, {
      method: 'POST',
      body: reason ? { reason } : {},
      retry: false,
    });
  },
  reject(id: string, reason: string) {
    return apiRequest<KycSubmission>(`/admin/kyc/${id}/reject`, {
      method: 'POST',
      body: { reason },
      retry: false,
    });
  },
};
