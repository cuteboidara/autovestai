import { AdminRole, UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  sessionId?: string;
  adminRole?: AdminRole | null;
  permissions: string[];
  adminRoles: Array<{
    id: string;
    name: string;
  }>;
  isSeededSuperAdmin?: boolean;
}
