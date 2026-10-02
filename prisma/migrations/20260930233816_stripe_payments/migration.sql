-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "applicationFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failureMessage" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "stripeChargeId" TEXT;

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeChargeId_key" ON "Order"("stripeChargeId");

