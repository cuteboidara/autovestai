-- CreateEnum
CREATE TYPE "Network" AS ENUM ('TRC20', 'ERC20');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'CONFIRMING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'SENT', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "DepositAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "network" "Network" NOT NULL DEFAULT 'TRC20',
    "address" TEXT NOT NULL,
    "derivationIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "network" "Network" NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "usdtAmount" DECIMAL(18,8) NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "fee" DECIMAL(18,8) NOT NULL DEFAULT 2,
    "netAmount" DECIMAL(18,8) NOT NULL,
    "network" "Network" NOT NULL,
    "toAddress" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "txHash" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_address_key" ON "DepositAddress"("address");

-- CreateIndex
CREATE INDEX "DepositAddress_accountId_idx" ON "DepositAddress"("accountId");

-- CreateIndex
CREATE INDEX "DepositAddress_network_createdAt_idx" ON "DepositAddress"("network", "createdAt");

-- CreateIndex
CREATE INDEX "DepositAddress_derivationIndex_idx" ON "DepositAddress"("derivationIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_userId_network_key" ON "DepositAddress"("userId", "network");

-- CreateIndex
CREATE UNIQUE INDEX "DepositAddress_network_address_key" ON "DepositAddress"("network", "address");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_txHash_key" ON "Deposit"("txHash");

-- CreateIndex
CREATE INDEX "Deposit_userId_idx" ON "Deposit"("userId");

-- CreateIndex
CREATE INDEX "Deposit_accountId_idx" ON "Deposit"("accountId");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE INDEX "Deposit_createdAt_idx" ON "Deposit"("createdAt");

-- CreateIndex
CREATE INDEX "Deposit_network_status_idx" ON "Deposit"("network", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_userId_idx" ON "WithdrawalRequest"("userId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_accountId_idx" ON "WithdrawalRequest"("accountId");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_idx" ON "WithdrawalRequest"("status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_createdAt_idx" ON "WithdrawalRequest"("createdAt");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_network_status_idx" ON "WithdrawalRequest"("network", "status");

-- CreateIndex
CREATE INDEX "WithdrawalRequest_reviewedById_reviewedAt_idx" ON "WithdrawalRequest"("reviewedById", "reviewedAt");

-- AddForeignKey
ALTER TABLE "DepositAddress" ADD CONSTRAINT "DepositAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositAddress" ADD CONSTRAINT "DepositAddress_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing TRC20 / ERC20 deposit addresses from the legacy wallet table.
WITH ranked_legacy_addresses AS (
    SELECT
        uda."id" AS legacy_id,
        uda."userId",
        uda."address",
        uda."createdAt",
        CASE
            WHEN UPPER(uda."network") IN ('TRC20', 'USDT-TRC20') THEN 'TRC20'::"Network"
            WHEN UPPER(uda."network") IN ('ERC20', 'USDT-ERC20') THEN 'ERC20'::"Network"
            ELSE NULL
        END AS mapped_network,
        ROW_NUMBER() OVER (ORDER BY uda."createdAt", uda."id") AS derivation_index
    FROM "UserDepositAddress" uda
    WHERE UPPER(uda."network") IN ('TRC20', 'USDT-TRC20', 'ERC20', 'USDT-ERC20')
),
resolved_accounts AS (
    SELECT
        rla.*,
        account_choice."id" AS account_id
    FROM ranked_legacy_addresses rla
    JOIN LATERAL (
        SELECT a."id"
        FROM "Account" a
        WHERE a."userId" = rla."userId"
          AND a."status" <> 'CLOSED'
        ORDER BY a."isDefault" DESC, a."createdAt" ASC
        LIMIT 1
    ) AS account_choice ON TRUE
    WHERE rla.mapped_network IS NOT NULL
)
INSERT INTO "DepositAddress" (
    "id",
    "userId",
    "accountId",
    "network",
    "address",
    "derivationIndex",
    "createdAt"
)
SELECT
    'migrated_' || md5(resolved_accounts.legacy_id || ':' || resolved_accounts."userId"),
    resolved_accounts."userId",
    resolved_accounts.account_id,
    resolved_accounts.mapped_network,
    resolved_accounts."address",
    resolved_accounts.derivation_index,
    resolved_accounts."createdAt"
FROM resolved_accounts
ON CONFLICT ("userId", "network") DO NOTHING;
