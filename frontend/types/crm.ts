import { OrderRecord, PositionRecord } from './trading';
import { KycDecisionLogRecord, KycDocumentRecord } from './kyc';
import { WalletTransaction } from './wallet';

export interface CrmClientListItem {
  id: string;
  accountNumber: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  country: string | null;
  kycStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  balance: number;
  accounts: number;
  registeredAt: string;
  lastLoginAt: string | null;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MIXED' | 'NONE';
}

export interface CrmClientListResponse {
  items: CrmClientListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CrmClientNote {
  id: string;
  clientId: string;
  authorId: string;
  content: string;
  noteType: 'GENERAL' | 'COMPLIANCE' | 'SUPPORT' | 'RISK' | 'FINANCIAL';
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    email: string;
    accountNumber?: string;
    displayName: string;
  } | null;
}

export interface CrmEmailLog {
  id: string;
  toUserId: string;
  fromEmail: string;
  subject: string;
  body: string;
  status: 'SENT' | 'FAILED' | 'BOUNCED';
  sentAt: string;
  sentById: string;
  toUser?: {
    id: string;
    email: string;
    accountNumber?: string;
  } | null;
  sentBy?: {
    id: string;
    email: string;
    accountNumber?: string;
    displayName: string;
  } | null;
  error?: string;
}

export interface CrmEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmEmailSenderConfig {
  id: string;
  name: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmClientAccount {
  id: string;
  type: 'LIVE' | 'DEMO';
  name: string;
  accountNo: string;
  balance: number;
  equity: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  openPositions: number;
  createdAt: string;
}

export interface CrmClientProfile {
  id: string;
  accountNumber: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | 'MIXED' | 'NONE';
  stats: {
    totalBalance: number;
    totalTrades: number;
    totalDeposits: number;
  };
  accounts: CrmClientAccount[];
  kycSubmission: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    fullName: string;
    dateOfBirth: string;
    country: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    documentType: string;
    documentNumber: string;
    documentFrontUrl?: string | null;
    documentBackUrl?: string | null;
    selfieUrl?: string | null;
    proofOfAddressUrl?: string | null;
    rejectionReason?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    documents: KycDocumentRecord[];
    decisionLogs: KycDecisionLogRecord[];
  } | null;
  positions: PositionRecord[];
  orders: OrderRecord[];
  transactions: WalletTransaction[];
  notes: CrmClientNote[];
  emailLogs: CrmEmailLog[];
}

export interface CrmEmailSendResponse {
  total: number;
  sent: number;
  failed: number;
  results: Array<CrmEmailLog | { status: 'FAILED'; error?: string }>;
}
