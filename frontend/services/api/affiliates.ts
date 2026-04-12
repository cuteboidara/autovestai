import {
  AffiliateCommission,
  AffiliateProfile,
  AffiliateReferral,
  AffiliateTreeNode,
} from '@/types/affiliates';

import { apiRequest } from './http';

export const affiliatesApi = {
  apply(payload: { referralCodePrefix?: string }) {
    return apiRequest<AffiliateProfile>('/affiliates/apply', {
      method: 'POST',
      body: payload,
      retry: false,
    });
  },
  getMe() {
    return apiRequest<AffiliateProfile | null>('/affiliates/me');
  },
  getTree() {
    return apiRequest<AffiliateTreeNode | null>('/affiliates/tree');
  },
  getCommissions() {
    return apiRequest<AffiliateCommission[]>('/affiliates/commissions');
  },
  getReferrals() {
    return apiRequest<AffiliateReferral[]>('/affiliates/referrals');
  },
  assignParent(id: string, parentAffiliateId: string) {
    return apiRequest<unknown>(`/affiliates/${id}/assign-parent`, {
      method: 'POST',
      body: { parentAffiliateId },
      retry: false,
    });
  },
  approveCommission(id: string) {
    return apiRequest<AffiliateCommission>(`/affiliates/commission/${id}/approve`, {
      method: 'POST',
      retry: false,
    });
  },
  payCommission(id: string) {
    return apiRequest<AffiliateCommission>(`/affiliates/commission/${id}/pay`, {
      method: 'POST',
      retry: false,
    });
  },
};
