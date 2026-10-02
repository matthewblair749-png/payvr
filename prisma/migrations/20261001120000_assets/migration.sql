-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_merchantId_sha256_key" ON "Asset"("merchantId", "sha256");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

