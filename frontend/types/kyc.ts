export interface KycSubmission {
  id?: string;
  userId?: string;
  status: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  fullName?: string;
  dateOfBirth?: string;
  country?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  documentType?: string;
  documentNumber?: string;
  documentFrontUrl?: string | null;
  documentBackUrl?: string | null;
  selfieUrl?: string | null;
  proofOfAddressUrl?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents?: KycDocumentRecord[];
  decisionLogs?: KycDecisionLogRecord[];
  user?: {
    id: string;
    email: string;
    accountNumber?: string;
  };
}

export interface KycDocumentRecord {
  id: string;
  kind:
    | 'DOCUMENT_FRONT'
    | 'DOCUMENT_BACK'
    | 'SELFIE'
    | 'PROOF_OF_ADDRESS'
    | 'ADDITIONAL';
  label?: string | null;
  fileUrl: string;
  mimeType: string;
  originalName: string;
  createdAt: string;
}

export interface KycDecisionLogRecord {
  id: string;
  fromStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  toStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    email: string;
    accountNumber?: string;
    displayName: string;
  } | null;
}
