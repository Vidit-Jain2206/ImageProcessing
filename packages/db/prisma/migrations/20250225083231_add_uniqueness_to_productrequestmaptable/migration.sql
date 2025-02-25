/*
  Warnings:

  - A unique constraint covering the columns `[requestId,productId]` on the table `ProductRequestMapping` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ProductRequestMapping_requestId_productId_key" ON "ProductRequestMapping"("requestId", "productId");
