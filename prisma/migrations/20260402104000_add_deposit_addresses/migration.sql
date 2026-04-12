-- CreateTable
CREATE TABLE "UserDepositAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDepositAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserDepositAddress_userId_network_key" ON "UserDepositAddress"("userId", "network");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepositAddress_network_address_key" ON "UserDepositAddress"("network", "address");

-- CreateIndex
CREATE INDEX "UserDepositAddress_network_createdAt_idx" ON "UserDepositAddress"("network", "createdAt");

-- AddForeignKey
ALTER TABLE "UserDepositAddress" ADD CONSTRAINT "UserDepositAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
