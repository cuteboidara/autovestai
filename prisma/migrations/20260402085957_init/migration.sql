-- CreateEnum
CREATE TYPE "SymbolCategory" AS ENUM ('FOREX', 'METALS', 'INDICES', 'COMMODITIES', 'CRYPTO', 'STOCKS', 'ETFS');

-- CreateEnum
CREATE TYPE "QuoteSource" AS ENUM ('BINANCE', 'FOREX_API', 'YAHOO', 'SYNTHETIC', 'MANUAL');

-- AlterTable
ALTER TABLE "Position" ADD COLUMN     "contractSize" DECIMAL(20,8) NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Symbol" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SymbolCategory" NOT NULL,
    "marketGroup" TEXT,
    "lotSize" DECIMAL(20,8) NOT NULL,
    "marginRetailPct" DECIMAL(10,4) NOT NULL,
    "marginProPct" DECIMAL(10,4) NOT NULL,
    "swapLong" DECIMAL(20,8) NOT NULL,
    "swapShort" DECIMAL(20,8) NOT NULL,
    "digits" INTEGER NOT NULL,
    "minTickIncrement" DECIMAL(20,8) NOT NULL,
    "minTradeSizeLots" DECIMAL(20,8) NOT NULL,
    "maxTradeSizeLots" DECIMAL(20,8) NOT NULL,
    "pipValue" TEXT NOT NULL,
    "tradingHours" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultSpread" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "quoteSource" "QuoteSource" NOT NULL DEFAULT 'MANUAL',
    "quoteSymbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Symbol_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Symbol_symbol_key" ON "Symbol"("symbol");

-- CreateIndex
CREATE INDEX "Symbol_category_isActive_idx" ON "Symbol"("category", "isActive");

-- CreateIndex
CREATE INDEX "Symbol_quoteSource_isActive_idx" ON "Symbol"("quoteSource", "isActive");

-- CreateIndex
CREATE INDEX "Symbol_marketGroup_isActive_idx" ON "Symbol"("marketGroup", "isActive");
