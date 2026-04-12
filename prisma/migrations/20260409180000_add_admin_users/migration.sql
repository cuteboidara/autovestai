-- DropForeignKey
ALTER TABLE "AdminRolePermission" DROP CONSTRAINT "AdminRolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "AdminRolePermission" DROP CONSTRAINT "AdminRolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserAdminRole" DROP CONSTRAINT "UserAdminRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserAdminRole" DROP CONSTRAINT "UserAdminRole_userId_fkey";

-- DropTable
DROP TABLE "AdminPermission";

-- DropTable
DROP TABLE "AdminRole";

-- DropTable
DROP TABLE "AdminRolePermission";

-- DropTable
DROP TABLE "UserAdminRole";

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'COMPLIANCE', 'SUPPORT', 'RISK', 'FINANCE');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'SUPPORT',
    "permissions" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AdminUser_role_isActive_idx" ON "AdminUser"("role", "isActive");

-- CreateIndex
CREATE INDEX "AdminUser_createdById_createdAt_idx" ON "AdminUser"("createdById", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
