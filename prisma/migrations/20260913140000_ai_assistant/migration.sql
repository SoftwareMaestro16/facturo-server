-- CreateEnum
CREATE TYPE "AiRequestKind" AS ENUM ('INVOICE_DRAFT');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "aiEnabledAt" TIMESTAMP(3),
ADD COLUMN     "aiEnabledByUserId" TEXT;

-- CreateTable
CREATE TABLE "AiRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AiRequestKind" NOT NULL,
    "succeeded" BOOLEAN NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiRequest_companyId_createdAt_idx" ON "AiRequest"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
