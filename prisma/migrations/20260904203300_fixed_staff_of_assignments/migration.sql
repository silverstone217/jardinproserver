/*
  Warnings:

  - You are about to drop the column `endDate` on the `StaffAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `StaffAssignment` table. All the data in the column will be lost.
  - Made the column `pointOfSaleId` on table `StaffAssignment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "StaffAssignment" DROP CONSTRAINT "StaffAssignment_pointOfSaleId_fkey";

-- AlterTable
ALTER TABLE "StaffAssignment" DROP COLUMN "endDate",
DROP COLUMN "startDate",
ALTER COLUMN "pointOfSaleId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "StaffAssignment_pointOfSaleId_isActive_idx" ON "StaffAssignment"("pointOfSaleId", "isActive");

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_pointOfSaleId_fkey" FOREIGN KEY ("pointOfSaleId") REFERENCES "PointOfSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
