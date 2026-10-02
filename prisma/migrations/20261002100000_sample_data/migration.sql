-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "isSample" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showSample" BOOLEAN NOT NULL DEFAULT true;

