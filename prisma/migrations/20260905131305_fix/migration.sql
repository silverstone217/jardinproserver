/*
  Warnings:

  - Added the required column `packagingId` to the `ProductVariant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "packagingId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ProductVariant_packagingId_idx" ON "ProductVariant"("packagingId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
