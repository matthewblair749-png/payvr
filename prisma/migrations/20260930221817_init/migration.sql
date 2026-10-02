-- CreateEnum
CREATE TYPE "CheckoutPageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'STOPPED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CheckoutEventType" AS ENUM ('VIEW', 'FIELD_FOCUS', 'STEP', 'PAY_CLICK', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'ABANDON');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "stripeChargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeDetailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'usd',
    "firstSaleAt" TIMESTAMP(3),
    "firstSaleCelebratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "imageUrl" TEXT,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutPage" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "CheckoutPageStatus" NOT NULL DEFAULT 'DRAFT',
    "draftConfig" JSONB NOT NULL,
    "publishedVersionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutPageVersion" (
    "id" TEXT NOT NULL,
    "checkoutPageId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutPageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "checkoutPageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL DEFAULT '',
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "primaryMetric" TEXT NOT NULL DEFAULT 'conversion',
    "winnerVariantId" TEXT,
    "sourceInsightId" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "publishedConfig" JSONB,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "checkoutPageId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "tipCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "customerEmail" TEXT,
    "country" TEXT,
    "paymentMethod" TEXT,
    "device" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutEvent" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "checkoutPageId" TEXT NOT NULL,
    "variantId" TEXT,
    "sessionId" TEXT NOT NULL,
    "type" "CheckoutEventType" NOT NULL,
    "step" TEXT,
    "field" TEXT,
    "paymentMethod" TEXT,
    "device" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "checkoutPageId" TEXT,
    "orderId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_userId_key" ON "Merchant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_stripeAccountId_key" ON "Merchant"("stripeAccountId");

-- CreateIndex
CREATE INDEX "Product_merchantId_idx" ON "Product"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutPage_slug_key" ON "CheckoutPage"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutPage_publishedVersionId_key" ON "CheckoutPage"("publishedVersionId");

-- CreateIndex
CREATE INDEX "CheckoutPage_merchantId_idx" ON "CheckoutPage"("merchantId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutPageVersion_checkoutPageId_number_key" ON "CheckoutPageVersion"("checkoutPageId", "number");

-- CreateIndex
CREATE INDEX "Experiment_merchantId_idx" ON "Experiment"("merchantId");

-- CreateIndex
CREATE INDEX "Experiment_checkoutPageId_status_idx" ON "Experiment"("checkoutPageId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_experimentId_key_key" ON "Variant"("experimentId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Order_merchantId_createdAt_idx" ON "Order"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutEvent_merchantId_createdAt_idx" ON "CheckoutEvent"("merchantId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutEvent_checkoutPageId_createdAt_idx" ON "CheckoutEvent"("checkoutPageId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckoutEvent_sessionId_idx" ON "CheckoutEvent"("sessionId");

-- CreateIndex
CREATE INDEX "SurveyResponse_merchantId_question_createdAt_idx" ON "SurveyResponse"("merchantId", "question", "createdAt");

-- CreateIndex
CREATE INDEX "Insight_merchantId_createdAt_idx" ON "Insight"("merchantId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutPage" ADD CONSTRAINT "CheckoutPage_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutPage" ADD CONSTRAINT "CheckoutPage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutPage" ADD CONSTRAINT "CheckoutPage_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "CheckoutPageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutPageVersion" ADD CONSTRAINT "CheckoutPageVersion_checkoutPageId_fkey" FOREIGN KEY ("checkoutPageId") REFERENCES "CheckoutPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_checkoutPageId_fkey" FOREIGN KEY ("checkoutPageId") REFERENCES "CheckoutPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutPageId_fkey" FOREIGN KEY ("checkoutPageId") REFERENCES "CheckoutPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutEvent" ADD CONSTRAINT "CheckoutEvent_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutEvent" ADD CONSTRAINT "CheckoutEvent_checkoutPageId_fkey" FOREIGN KEY ("checkoutPageId") REFERENCES "CheckoutPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutEvent" ADD CONSTRAINT "CheckoutEvent_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_checkoutPageId_fkey" FOREIGN KEY ("checkoutPageId") REFERENCES "CheckoutPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
