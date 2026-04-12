-- CreateEnum
CREATE TYPE "NoteType" AS ENUM ('GENERAL', 'COMPLIANCE', 'SUPPORT', 'RISK', 'FINANCIAL');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "KycDocumentKind" AS ENUM ('DOCUMENT_FRONT', 'DOCUMENT_BACK', 'SELFIE', 'PROOF_OF_ADDRESS', 'ADDITIONAL');

-- AlterTable
ALTER TABLE "KycSubmission" ADD COLUMN "proofOfAddressUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountNumber" TEXT;

-- Backfill
WITH ranked_users AS (
  SELECT
    "id",
    'AV' || LPAD((ROW_NUMBER() OVER (ORDER BY "createdAt", "id"))::text, 6, '0') AS account_number
  FROM "User"
)
UPDATE "User" AS target
SET "accountNumber" = ranked_users.account_number
FROM ranked_users
WHERE target."id" = ranked_users."id"
  AND target."accountNumber" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "accountNumber" SET NOT NULL;

-- CreateTable
CREATE TABLE "ClientNote" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "noteType" "NoteType" NOT NULL DEFAULT 'GENERAL',
    "isInternal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentById" TEXT NOT NULL,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSenderConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "smtpHost" TEXT NOT NULL,
    "smtpPort" INTEGER NOT NULL,
    "smtpUser" TEXT NOT NULL,
    "smtpPass" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSenderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "kind" "KycDocumentKind" NOT NULL,
    "label" TEXT,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycDecisionLog" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "fromStatus" "KycStatus",
    "toStatus" "KycStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycDecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminMessage" (
    "id" TEXT NOT NULL,
    "authorId" TEXT,
    "content" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'general',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readBy" TEXT[],

    CONSTRAINT "AdminMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientNote_clientId_createdAt_idx" ON "ClientNote"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ClientNote_authorId_createdAt_idx" ON "ClientNote"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_toUserId_sentAt_idx" ON "EmailLog"("toUserId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailLog_sentById_sentAt_idx" ON "EmailLog"("sentById", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSenderConfig_fromEmail_key" ON "EmailSenderConfig"("fromEmail");

-- CreateIndex
CREATE INDEX "KycDocument_submissionId_kind_createdAt_idx" ON "KycDocument"("submissionId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "KycDecisionLog_submissionId_createdAt_idx" ON "KycDecisionLog"("submissionId", "createdAt");

-- CreateIndex
CREATE INDEX "KycDecisionLog_userId_createdAt_idx" ON "KycDecisionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "KycDecisionLog_reviewerId_createdAt_idx" ON "KycDecisionLog"("reviewerId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_channel_createdAt_idx" ON "AdminMessage"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "AdminMessage_authorId_createdAt_idx" ON "AdminMessage"("authorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_accountNumber_key" ON "User"("accountNumber");

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientNote" ADD CONSTRAINT "ClientNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KycSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDecisionLog" ADD CONSTRAINT "KycDecisionLog_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "KycSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDecisionLog" ADD CONSTRAINT "KycDecisionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDecisionLog" ADD CONSTRAINT "KycDecisionLog_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminMessage" ADD CONSTRAINT "AdminMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
