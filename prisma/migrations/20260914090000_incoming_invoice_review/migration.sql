-- Evidence for an INCOMING document, and a purely local "the buyer disputes
-- this" marker that never pretends to be a platform status.
ALTER TABLE "Invoice" ADD COLUMN "rawXml" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "disputedAt" TIMESTAMP(3);
