-- CreateEnum
CREATE TYPE "AmlScreeningResult" AS ENUM ('PASS', 'FAIL', 'MANUAL_REVIEW');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "twoFaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFaSecret" TEXT;

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "acknowledgedDeadline" TIMESTAMP(3),
ADD COLUMN     "resolutionDeadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AmlScreening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "screeningType" TEXT NOT NULL,
    "resultStatus" "AmlScreeningResult" NOT NULL,
    "matchedName" TEXT,
    "matchedCountry" TEXT,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "screeningData" JSONB NOT NULL,
    "screenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextScreeningDue" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmlScreening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfacSdn" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sdnType" TEXT NOT NULL,
    "program" TEXT,
    "nameFragments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfacSdn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HighRiskCountry" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "HighRiskCountry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AmlScreening_userId_screeningType_idx" ON "AmlScreening"("userId", "screeningType");

-- CreateIndex
CREATE INDEX "AmlScreening_resultStatus_nextScreeningDue_idx" ON "AmlScreening"("resultStatus", "nextScreeningDue");

-- CreateIndex
CREATE UNIQUE INDEX "OfacSdn_entityId_key" ON "OfacSdn"("entityId");

-- CreateIndex
CREATE INDEX "OfacSdn_name_idx" ON "OfacSdn"("name");

-- CreateIndex
CREATE UNIQUE INDEX "HighRiskCountry_countryCode_key" ON "HighRiskCountry"("countryCode");

-- CreateIndex
CREATE INDEX "HighRiskCountry_countryCode_idx" ON "HighRiskCountry"("countryCode");

-- AddForeignKey
ALTER TABLE "AmlScreening" ADD CONSTRAINT "AmlScreening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
