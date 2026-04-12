export interface AdminSessionViewDto {
  id: string;
  deviceFingerprintMasked: string;
  ipAddressMasked: string | null;
  userAgent: string | null;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}
