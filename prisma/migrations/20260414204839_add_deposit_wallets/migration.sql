-- CreateTable
CREATE TABLE "DepositWallet" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "coin" TEXT NOT NULL DEFAULT 'USDT',
    "address" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minDeposit" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DepositWallet_isActive_idx" ON "DepositWallet"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DepositWallet_network_coin_key" ON "DepositWallet"("network", "coin");
