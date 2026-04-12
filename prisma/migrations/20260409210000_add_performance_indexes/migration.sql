CREATE INDEX IF NOT EXISTS "Account_userId_idx" ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Account_status_idx" ON "Account"("status");
CREATE INDEX IF NOT EXISTS "Account_createdAt_idx" ON "Account"("createdAt");

CREATE INDEX IF NOT EXISTS "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX IF NOT EXISTS "Transaction_accountId_idx" ON "Transaction"("accountId");
CREATE INDEX IF NOT EXISTS "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt");

CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "Order_accountId_idx" ON "Order"("accountId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt");

CREATE INDEX IF NOT EXISTS "Position_userId_idx" ON "Position"("userId");
CREATE INDEX IF NOT EXISTS "Position_accountId_idx" ON "Position"("accountId");
CREATE INDEX IF NOT EXISTS "Position_status_idx" ON "Position"("status");
CREATE INDEX IF NOT EXISTS "Position_createdAt_idx" ON "Position"("createdAt");
