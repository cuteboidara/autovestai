export interface AffiliateProfile {
  id: string;
  userId: string;
  referralCode: string;
  parentAffiliateId?: string | null;
  level: number;
  status: 'ACTIVE' | 'DISABLED';
  totalCommission?: number;
}

export interface AffiliateReferral {
  id: string;
  affiliateId: string;
  referredUserId: string;
  createdAt: string;
  referredUser?: {
    id: string;
    email: string;
    createdAt: string;
  };
}

export interface AffiliateCommission {
  id: string;
  affiliateId: string;
  referredUserId: string;
  orderId: string;
  symbol: string;
  volume: string | number;
  commissionAmount: string | number;
  level: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  affiliate?: {
    id: string;
    user?: {
      id: string;
      email: string;
    };
  };
  referredUser?: {
    id: string;
    email: string;
  };
}

export interface AffiliateTreeNode {
  id: string;
  userId: string;
  referralCode: string;
  parentAffiliateId: string | null;
  level: number;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: string;
  updatedAt: string;
  children: AffiliateTreeNode[];
}
