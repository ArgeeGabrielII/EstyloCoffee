-- Auditable end-of-day financial close snapshots.
-- Existing orders are unchanged and remain queryable.
CREATE TABLE "BusinessDayClose" (
    "businessDate" DATE NOT NULL,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedBy" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "paidOrderCount" INTEGER NOT NULL,
    "salesCentavos" INTEGER NOT NULL,
    "unpaidOrderCount" INTEGER NOT NULL,
    "unfinishedCount" INTEGER NOT NULL,
    CONSTRAINT "BusinessDayClose_pkey" PRIMARY KEY ("businessDate")
);
ALTER TABLE "BusinessDayClose" ADD CONSTRAINT "BusinessDayClose_finalizedBy_fkey"
    FOREIGN KEY ("finalizedBy") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
