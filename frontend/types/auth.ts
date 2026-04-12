export type UserRole = 'USER' | 'ADMIN';
export type AdminUserRole =
  | 'SUPER_ADMIN'
  | 'COMPLIANCE'
  | 'SUPPORT'
  | 'RISK'
  | 'FINANCE';

export interface AdminRoleAssignment {
  id: string;
  name: string;
}

export interface AuthUser {
  id: string;
  email: string;
  accountNumber?: string;
  role: UserRole;
  adminRole?: AdminUserRole | null;
  permissions: string[];
  adminRoles: AdminRoleAssignment[];
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  isSeededSuperAdmin?: boolean;
  wallet?: {
    balance?: number;
  } | null;
  affiliate?: {
    id: string;
    status: string;
    referralCode: string;
  } | null;
  copyMaster?: {
    id: string;
    status: string;
    displayName: string;
  } | null;
  kyc?: {
    status: string;
    rejectionReason?: string | null;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  referralCode?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: AuthUser;
}

export interface UserSession {
  id: string;
  deviceFingerprint: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
  isCurrent: boolean;
}
