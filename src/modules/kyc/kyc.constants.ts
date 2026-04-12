import { KycStatus } from '@prisma/client';

export const KYC_APPROVAL_REQUIRED_MESSAGE =
  'KYC approval required before platform access';

export type UserKycAccessStatus = KycStatus | 'NOT_SUBMITTED';
