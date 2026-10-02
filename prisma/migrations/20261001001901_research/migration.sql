-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "priceCents" INTEGER;

-- CreateTable
CREATE TABLE "ResearchThread" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchThread_merchantId_updatedAt_idx" ON "ResearchThread"("merchantId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchMessage_threadId_seq_key" ON "ResearchMessage"("threadId", "seq");

-- AddForeignKey
ALTER TABLE "ResearchThread" ADD CONSTRAINT "ResearchThread_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchMessage" ADD CONSTRAINT "ResearchMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ResearchThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

