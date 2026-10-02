-- AlterTable
ALTER TABLE "CheckoutEvent" ADD COLUMN     "source" TEXT,
ADD COLUMN     "valueCents" INTEGER,
ADD COLUMN     "visitorId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "requiresShipping" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CheckoutEvent_merchantId_visitorId_createdAt_idx" ON "CheckoutEvent"("merchantId", "visitorId", "createdAt");

