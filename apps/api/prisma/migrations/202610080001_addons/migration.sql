CREATE TABLE "Addon" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priceCentavos" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Addon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Addon_price"
    CHECK ("priceCentavos" BETWEEN 1 AND 1000000)
);

CREATE UNIQUE INDEX "Addon_name_key" ON "Addon"("name");

CREATE TABLE "OrderItemAddon" (
  "id" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "addonId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPriceCentavos" INTEGER NOT NULL,
  CONSTRAINT "OrderItemAddon_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItemAddon_quantity"
    CHECK ("quantity" BETWEEN 1 AND 99),
  CONSTRAINT "OrderItemAddon_price"
    CHECK ("unitPriceCentavos" BETWEEN 1 AND 1000000)
);

ALTER TABLE "OrderItemAddon"
ADD CONSTRAINT "OrderItemAddon_orderItemId_fkey"
FOREIGN KEY ("orderItemId")
REFERENCES "OrderItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItemAddon"
ADD CONSTRAINT "OrderItemAddon_addonId_fkey"
FOREIGN KEY ("addonId")
REFERENCES "Addon"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;