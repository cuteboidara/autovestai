-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('LIVE', 'DEMO');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('ACTIVE', 'PAUSED', 'STOPPED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'LIVE',
    "name" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "balance" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "equity" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- Seed one default LIVE account for every existing user before wiring accountId
-- into legacy trading tables.
INSERT INTO "Account" (
    "id",
    "userId",
    "type",
    "name",
    "accountNo",
    "balance",
    "equity",
    "currency",
    "status",
    "isDefault",
    "createdAt",
    "updatedAt"
)
SELECT
    'acc_' || REPLACE("User"."id", '-', ''),
    "User"."id",
    'LIVE'::"AccountType",
    'Live Account',
    'FF' || LPAD(ROW_NUMBER() OVER (ORDER BY "User"."createdAt", "User"."id")::text, 6, '0'),
    COALESCE("Wallet"."balance", 0),
    COALESCE("Wallet"."balance", 0),
    'USDT',
    'ACTIVE'::"AccountStatus",
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
LEFT JOIN "Wallet" ON "Wallet"."userId" = "User"."id";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "accountId" TEXT;

-- AlterTable
ALTER TABLE "Position" ADD COLUMN "accountId" TEXT,
ADD COLUMN "copiedFromTradeId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "accountId" TEXT;

-- Backfill account ownership for legacy rows using the default LIVE account we
-- just created for each user.
UPDATE "Order"
SET "accountId" = "Account"."id"
FROM "Account"
WHERE "Account"."userId" = "Order"."userId"
  AND "Account"."isDefault" = true;

UPDATE "Position"
SET "accountId" = "Account"."id"
FROM "Account"
WHERE "Account"."userId" = "Position"."userId"
  AND "Account"."isDefault" = true;

UPDATE "Transaction"
SET "accountId" = "Account"."id"
FROM "Account"
WHERE "Account"."userId" = "Transaction"."userId"
  AND "Account"."isDefault" = true;

-- Enforce the new account requirement after backfill.
ALTER TABLE "Order" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Position" ALTER COLUMN "accountId" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "accountId" SET NOT NULL;

-- CreateTable
CREATE TABLE "SignalProvider" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "strategy" TEXT,
    "accountId" TEXT NOT NULL,
    "totalReturn" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "monthlyReturn" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "winRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "maxDrawdown" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "activeCopiers" INTEGER NOT NULL DEFAULT 0,
    "minCopyAmount" DECIMAL(18,8) NOT NULL DEFAULT 100,
    "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isAccepting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyRelation" (
    "id" TEXT NOT NULL,
    "copierId" TEXT NOT NULL,
    "copyAccountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(18,8) NOT NULL,
    "copyRatio" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "status" "CopyStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalCopiedPnl" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "feesPaid" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountNo_key" ON "Account"("accountNo");

-- CreateIndex
CREATE INDEX "Account_userId_status_idx" ON "Account"("userId", "status");

-- CreateIndex
CREATE INDEX "Account_userId_isDefault_idx" ON "Account"("userId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "SignalProvider_userId_key" ON "SignalProvider"("userId");

-- CreateIndex
CREATE INDEX "SignalProvider_isPublic_isAccepting_createdAt_idx" ON "SignalProvider"("isPublic", "isAccepting", "createdAt");

-- CreateIndex
CREATE INDEX "SignalProvider_accountId_idx" ON "SignalProvider"("accountId");

-- CreateIndex
CREATE INDEX "CopyRelation_providerId_status_idx" ON "CopyRelation"("providerId", "status");

-- CreateIndex
CREATE INDEX "CopyRelation_copierId_status_idx" ON "CopyRelation"("copierId", "status");

-- CreateIndex
CREATE INDEX "CopyRelation_copyAccountId_status_idx" ON "CopyRelation"("copyAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CopyRelation_copierId_providerId_copyAccountId_key" ON "CopyRelation"("copierId", "providerId", "copyAccountId");

-- CreateIndex
CREATE INDEX "Order_accountId_status_idx" ON "Order"("accountId", "status");

-- CreateIndex
CREATE INDEX "Position_accountId_status_idx" ON "Position"("accountId", "status");

-- CreateIndex
CREATE INDEX "Position_copiedFromTradeId_idx" ON "Position"("copiedFromTradeId");

-- CreateIndex
CREATE INDEX "Transaction_accountId_status_idx" ON "Transaction"("accountId", "status");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_copiedFromTradeId_fkey" FOREIGN KEY ("copiedFromTradeId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalProvider" ADD CONSTRAINT "SignalProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalProvider" ADD CONSTRAINT "SignalProvider_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyRelation" ADD CONSTRAINT "CopyRelation_copierId_fkey" FOREIGN KEY ("copierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyRelation" ADD CONSTRAINT "CopyRelation_copyAccountId_fkey" FOREIGN KEY ("copyAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyRelation" ADD CONSTRAINT "CopyRelation_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "SignalProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
