-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'TRADE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'OPEN', 'PROCESSING', 'EXECUTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderSourceType" AS ENUM ('MANUAL', 'COPY');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CopyMasterStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CopyAllocationType" AS ENUM ('FIXED', 'BALANCE_RATIO', 'EQUITY_RATIO');

-- CreateEnum
CREATE TYPE "CopyTradeStatus" AS ENUM ('OPEN', 'CLOSED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AffiliateCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "HedgeActionType" AS ENUM ('HEDGE_BUY', 'HEDGE_SELL', 'REDUCE', 'CLOSE');

-- CreateEnum
CREATE TYPE "HedgeActionStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'SENT', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SurveillanceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SurveillanceAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SurveillanceCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "lockedMargin" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(20,8) NOT NULL,
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "metadata" JSONB,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientRequestId" TEXT,
    "type" "OrderType" NOT NULL,
    "side" "OrderSide" NOT NULL,
    "symbol" TEXT NOT NULL,
    "volume" DECIMAL(20,8) NOT NULL,
    "leverage" INTEGER NOT NULL,
    "requestedPrice" DECIMAL(20,8),
    "executionPrice" DECIMAL(20,8),
    "sourceType" "OrderSourceType" NOT NULL DEFAULT 'MANUAL',
    "metadata" JSONB,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "entryPrice" DECIMAL(20,8) NOT NULL,
    "exitPrice" DECIMAL(20,8),
    "volume" DECIMAL(20,8) NOT NULL,
    "leverage" INTEGER NOT NULL,
    "margin" DECIMAL(20,8) NOT NULL,
    "marginUsed" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "liquidationPrice" DECIMAL(20,8),
    "pnl" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeExecution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "volume" DECIMAL(20,8) NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "realizedPnl" DECIMAL(20,8),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketCandle" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "resolution" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(20,8) NOT NULL,
    "high" DECIMAL(20,8) NOT NULL,
    "low" DECIMAL(20,8) NOT NULL,
    "close" DECIMAL(20,8) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketCandle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyMaster" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "CopyMasterStatus" NOT NULL DEFAULT 'PENDING',
    "performanceFeePercent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "minFollowerBalance" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyFollower" (
    "id" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "followerUserId" TEXT NOT NULL,
    "allocationType" "CopyAllocationType" NOT NULL,
    "allocationValue" DECIMAL(20,8) NOT NULL,
    "maxAllocation" DECIMAL(20,8) NOT NULL,
    "maxOpenTrades" INTEGER NOT NULL,
    "slippageTolerance" DECIMAL(20,8) NOT NULL,
    "symbolWhitelist" TEXT[],
    "symbolBlacklist" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTrade" (
    "id" TEXT NOT NULL,
    "masterPositionId" TEXT NOT NULL,
    "followerPositionId" TEXT,
    "masterId" TEXT NOT NULL,
    "followerUserId" TEXT NOT NULL,
    "status" "CopyTradeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "parentAffiliateId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateReferral" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "volume" DECIMAL(20,8) NOT NULL,
    "commissionAmount" DECIMAL(20,8) NOT NULL,
    "level" INTEGER NOT NULL,
    "status" "AffiliateCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SymbolExposureSnapshot" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "longVolume" DECIMAL(20,8) NOT NULL,
    "shortVolume" DECIMAL(20,8) NOT NULL,
    "netVolume" DECIMAL(20,8) NOT NULL,
    "weightedAvgLongPrice" DECIMAL(20,8),
    "weightedAvgShortPrice" DECIMAL(20,8),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SymbolExposureSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HedgeAction" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "actionType" "HedgeActionType" NOT NULL,
    "volume" DECIMAL(20,8) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "HedgeActionStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HedgeAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrokerSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentFrontUrl" TEXT,
    "documentBackUrl" TEXT,
    "selfieUrl" TEXT,
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "metadataJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPermission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "AdminRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAdminRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveillanceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "symbol" TEXT,
    "alertType" TEXT NOT NULL,
    "severity" "SurveillanceSeverity" NOT NULL,
    "status" "SurveillanceAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedByUserId" TEXT,
    "closedByUserId" TEXT,

    CONSTRAINT "SurveillanceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveillanceCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "alertId" TEXT,
    "status" "SurveillanceCaseStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToUserId" TEXT,
    "notesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveillanceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_status_idx" ON "Transaction"("userId", "status");

-- CreateIndex
CREATE INDEX "Transaction_type_status_idx" ON "Transaction"("type", "status");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_symbol_status_type_idx" ON "Order"("symbol", "status", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_clientRequestId_key" ON "Order"("userId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_orderId_key" ON "Position"("orderId");

-- CreateIndex
CREATE INDEX "Position_userId_status_idx" ON "Position"("userId", "status");

-- CreateIndex
CREATE INDEX "Position_symbol_status_idx" ON "Position"("symbol", "status");

-- CreateIndex
CREATE INDEX "TradeExecution_userId_createdAt_idx" ON "TradeExecution"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TradeExecution_orderId_idx" ON "TradeExecution"("orderId");

-- CreateIndex
CREATE INDEX "MarketCandle_symbol_resolution_timestamp_idx" ON "MarketCandle"("symbol", "resolution", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "MarketCandle_symbol_resolution_timestamp_key" ON "MarketCandle"("symbol", "resolution", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "CopyMaster_userId_key" ON "CopyMaster"("userId");

-- CreateIndex
CREATE INDEX "CopyMaster_status_idx" ON "CopyMaster"("status");

-- CreateIndex
CREATE INDEX "CopyFollower_followerUserId_enabled_idx" ON "CopyFollower"("followerUserId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "CopyFollower_masterId_followerUserId_key" ON "CopyFollower"("masterId", "followerUserId");

-- CreateIndex
CREATE INDEX "CopyTrade_masterPositionId_status_idx" ON "CopyTrade"("masterPositionId", "status");

-- CreateIndex
CREATE INDEX "CopyTrade_followerUserId_status_idx" ON "CopyTrade"("followerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CopyTrade_masterPositionId_followerUserId_key" ON "CopyTrade"("masterPositionId", "followerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_referralCode_key" ON "Affiliate"("referralCode");

-- CreateIndex
CREATE INDEX "Affiliate_referralCode_status_idx" ON "Affiliate"("referralCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateReferral_referredUserId_key" ON "AffiliateReferral"("referredUserId");

-- CreateIndex
CREATE INDEX "AffiliateReferral_affiliateId_idx" ON "AffiliateReferral"("affiliateId");

-- CreateIndex
CREATE INDEX "AffiliateCommission_affiliateId_status_idx" ON "AffiliateCommission"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliateCommission_referredUserId_createdAt_idx" ON "AffiliateCommission"("referredUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateCommission_orderId_idx" ON "AffiliateCommission"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_affiliateId_orderId_key" ON "AffiliateCommission"("affiliateId", "orderId");

-- CreateIndex
CREATE INDEX "SymbolExposureSnapshot_symbol_timestamp_idx" ON "SymbolExposureSnapshot"("symbol", "timestamp");

-- CreateIndex
CREATE INDEX "HedgeAction_symbol_status_idx" ON "HedgeAction"("symbol", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerSetting_key_key" ON "BrokerSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "KycSubmission_userId_key" ON "KycSubmission"("userId");

-- CreateIndex
CREATE INDEX "KycSubmission_status_createdAt_idx" ON "KycSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "AuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_requestId_createdAt_idx" ON "AuditLog"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_name_key" ON "AdminRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPermission_key_key" ON "AdminPermission"("key");

-- CreateIndex
CREATE INDEX "AdminRolePermission_permissionId_idx" ON "AdminRolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRolePermission_roleId_permissionId_key" ON "AdminRolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "UserAdminRole_roleId_idx" ON "UserAdminRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAdminRole_userId_roleId_key" ON "UserAdminRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "SurveillanceAlert_status_severity_createdAt_idx" ON "SurveillanceAlert"("status", "severity", "createdAt");

-- CreateIndex
CREATE INDEX "SurveillanceAlert_userId_createdAt_idx" ON "SurveillanceAlert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SurveillanceAlert_alertType_createdAt_idx" ON "SurveillanceAlert"("alertType", "createdAt");

-- CreateIndex
CREATE INDEX "SurveillanceCase_status_createdAt_idx" ON "SurveillanceCase"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SurveillanceCase_userId_createdAt_idx" ON "SurveillanceCase"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SurveillanceCase_assignedToUserId_createdAt_idx" ON "SurveillanceCase"("assignedToUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "UserSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_userId_expiresAt_idx" ON "UserSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_expiresAt_idx" ON "UserSession"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "UserSession_deviceFingerprint_createdAt_idx" ON "UserSession"("deviceFingerprint", "createdAt");

-- CreateIndex
CREATE INDEX "UserSession_ipAddress_createdAt_idx" ON "UserSession"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "TrustedDevice_deviceFingerprint_idx" ON "TrustedDevice"("deviceFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_userId_deviceFingerprint_key" ON "TrustedDevice"("userId", "deviceFingerprint");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeExecution" ADD CONSTRAINT "TradeExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeExecution" ADD CONSTRAINT "TradeExecution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyMaster" ADD CONSTRAINT "CopyMaster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyFollower" ADD CONSTRAINT "CopyFollower_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "CopyMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyFollower" ADD CONSTRAINT "CopyFollower_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTrade" ADD CONSTRAINT "CopyTrade_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "CopyMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTrade" ADD CONSTRAINT "CopyTrade_followerUserId_fkey" FOREIGN KEY ("followerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTrade" ADD CONSTRAINT "CopyTrade_masterPositionId_fkey" FOREIGN KEY ("masterPositionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTrade" ADD CONSTRAINT "CopyTrade_followerPositionId_fkey" FOREIGN KEY ("followerPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_parentAffiliateId_fkey" FOREIGN KEY ("parentAffiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AdminPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAdminRole" ADD CONSTRAINT "UserAdminRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAdminRole" ADD CONSTRAINT "UserAdminRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceAlert" ADD CONSTRAINT "SurveillanceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceAlert" ADD CONSTRAINT "SurveillanceAlert_acknowledgedByUserId_fkey" FOREIGN KEY ("acknowledgedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceAlert" ADD CONSTRAINT "SurveillanceAlert_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceCase" ADD CONSTRAINT "SurveillanceCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceCase" ADD CONSTRAINT "SurveillanceCase_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "SurveillanceAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveillanceCase" ADD CONSTRAINT "SurveillanceCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
