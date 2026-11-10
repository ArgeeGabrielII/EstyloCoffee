-- Store hours and non-destructive operational business dates.
-- Default 00:00-23:00 with a 60-minute review buffer preserves midnight
-- rollover until an administrator configures the actual store schedule.
CREATE TABLE "StoreHours" (
    "id" INTEGER NOT NULL,
    "openingTime" TEXT NOT NULL DEFAULT '00:00',
    "closingTime" TEXT NOT NULL DEFAULT '23:00',
    "bufferMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoreHours_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoreHours_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "StoreHours_buffer_check" CHECK ("bufferMinutes" BETWEEN 0 AND 360)
);
INSERT INTO "StoreHours" ("id", "openingTime", "closingTime", "bufferMinutes")
VALUES (1, '00:00', '23:00', 60)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Order" ADD COLUMN "businessDate" DATE;
-- Legacy orders were grouped by the Philippine calendar day; preserve that assignment.
UPDATE "Order" SET "businessDate" =
  (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::date;
ALTER TABLE "Order" ALTER COLUMN "businessDate" SET NOT NULL;
CREATE INDEX "Order_businessDate_idx" ON "Order"("businessDate");
