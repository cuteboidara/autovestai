CREATE TYPE "TreasuryBalanceSource" AS ENUM ('MANUAL', 'API');

CREATE TABLE "TreasuryBalanceSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "balance" DECIMAL(20,8) NOT NULL,
    "source" "TreasuryBalanceSource" NOT NULL,
    "sourceReference" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryBalanceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TreasuryBalanceSnapshot_asset_network_observedAt_idx" ON "TreasuryBalanceSnapshot"("asset", "network", "observedAt");
CREATE INDEX "TreasuryBalanceSnapshot_walletAddress_createdAt_idx" ON "TreasuryBalanceSnapshot"("walletAddress", "createdAt");
CREATE INDEX "TreasuryBalanceSnapshot_createdByUserId_createdAt_idx" ON "TreasuryBalanceSnapshot"("createdByUserId", "createdAt");

ALTER TABLE "TreasuryBalanceSnapshot"
ADD CONSTRAINT "TreasuryBalanceSnapshot_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
