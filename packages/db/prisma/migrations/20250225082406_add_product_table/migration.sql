/*
  Warnings:

  - You are about to drop the column `requestId` on the `Product` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Product" DROP CONSTRAINT "Product_requestId_fkey";

-- DropForeignKey
ALTER TABLE "ProductImageMapping" DROP CONSTRAINT "ProductImageMapping_productId_fkey";

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "requestId";

-- CreateTable
CREATE TABLE "ProductRequestMapping" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProductRequestMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductRequestMapping_requestId_productId_key" ON "ProductRequestMapping"("requestId", "productId");

-- AddForeignKey
ALTER TABLE "ProductRequestMapping" ADD CONSTRAINT "ProductRequestMapping_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("requestId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequestMapping" ADD CONSTRAINT "ProductRequestMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImageMapping" ADD CONSTRAINT "ProductImageMapping_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("productId") ON DELETE CASCADE ON UPDATE CASCADE;
