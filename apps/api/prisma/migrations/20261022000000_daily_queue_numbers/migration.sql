-- Existing orders remain unnumbered; new orders receive a daily queue number.
ALTER TABLE "Order" ADD COLUMN "queueNumber" INTEGER;
ALTER TABLE "Order" ADD COLUMN "queueDate" DATE;
CREATE UNIQUE INDEX "Order_queueDate_queueNumber_key" ON "Order"("queueDate", "queueNumber");
CREATE TABLE "DailyQueueCounter" (
  "day" DATE PRIMARY KEY,
  "lastNumber" INTEGER NOT NULL
);
