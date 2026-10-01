-- CreateTable
CREATE TABLE "MorningBrief" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sentence" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MorningBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MorningBrief_merchantId_day_key" ON "MorningBrief"("merchantId", "day");

-- AddForeignKey
ALTER TABLE "MorningBrief" ADD CONSTRAINT "MorningBrief_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

