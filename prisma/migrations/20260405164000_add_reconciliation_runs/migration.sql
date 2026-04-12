-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('OK', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "ReconciliationRunSource" AS ENUM ('MANUAL', 'SCHEDULED', 'ON_DEMAND', 'SYSTEM');

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "treasuryWalletAddress" TEXT,
    "latestTreasuryBalanceSnapshotId" TEXT,
    "treasuryBalance" DECIMAL(20,8),
    "internalClientLiabilities" DECIMAL(20,8) NOT NULL,
    "pendingDepositsTotal" DECIMAL(20,8) NOT NULL,
    "pendingWithdrawalsTotal" DECIMAL(20,8) NOT NULL,
    "approvedButNotSentWithdrawalsTotal" DECIMAL(20,8) NOT NULL,
    "grossDifference" DECIMAL(20,8),
    "operationalDifference" DECIMAL(20,8),
    "toleranceUsed" DECIMAL(20,8) NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "warningsJson" JSONB NOT NULL,
    "source" "ReconciliationRunSource" NOT NULL,
    "initiatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationRun_asset_network_createdAt_idx" ON "ReconciliationRun"("asset", "network", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationRun_status_createdAt_idx" ON "ReconciliationRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationRun_source_createdAt_idx" ON "ReconciliationRun"("source", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationRun_initiatedByUserId_createdAt_idx" ON "ReconciliationRun"("initiatedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ReconciliationRun_latestTreasuryBalanceSnapshotId_createdAt_idx" ON "ReconciliationRun"("latestTreasuryBalanceSnapshotId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_latestTreasuryBalanceSnapshotId_fkey" FOREIGN KEY ("latestTreasuryBalanceSnapshotId") REFERENCES "TreasuryBalanceSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRun" ADD CONSTRAINT "ReconciliationRun_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
