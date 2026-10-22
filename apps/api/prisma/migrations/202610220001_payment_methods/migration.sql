CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentMethod_name_key" ON "PaymentMethod"("name");
ALTER TABLE "Order"
    ADD COLUMN "paymentMethodId" TEXT,
    ADD COLUMN "paymentMethodName" TEXT,
    ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "Order"
    ADD CONSTRAINT "Order_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "PaymentMethod" ("id", "name", "active") VALUES
('b41b0e4b-2aef-4a1b-911e-c711ea0d11a1', 'Cash', true),
('b41b0e4b-2aef-4a1b-911e-c711ea0d11a2', 'Bank Transfer', true),
('b41b0e4b-2aef-4a1b-911e-c711ea0d11a3', 'GCash', true)
ON CONFLICT ("name") DO NOTHING;
