import { CoffeeService } from "./coffee.service";
import { PrismaService } from "./prisma/prisma.service";
const dto = {
  customer: "Customer",
  phone: "09123456789",
  address: "",
  fulfillment: "PICKUP" as const,
  source: "SMS" as const,
  items: [{ productId: "drink", quantity: 2 }],
};
function setup(price: number | null = 12500) {
  const tx = {
    $executeRaw: jest.fn(),
    product: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          id: "drink",
          name: "AMERICANO",
          active: true,
          priceCentavos: price,
        }),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(async (args) => ({ id: "order", ...args.data })),
    },
    auditLog: { create: jest.fn() },
  };
  const p = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) };
  return { service: new CoffeeService(p as unknown as PrismaService), tx };
}
describe("Coffee order orchestration", () => {
  it("uses authoritative price snapshots and writes audit in transaction", async () => {
    const { service, tx } = setup();
    const order = await service.create(dto, "request-key-123456", "cashier");
    expect(order.totalCentavos).toBe(25000);
    expect(
      tx.order.create.mock.calls[0][0].data.items.create[0].unitPriceCentavos,
    ).toBe(12500);
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
  it("returns prior order without adding duplicate lines", async () => {
    const { service, tx } = setup();
    tx.order.findUnique.mockResolvedValue({ id: "existing" });
    expect(await service.create(dto, "request-key-123456", "cashier")).toEqual({
      id: "existing",
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });
  it("rejects unconfigured menu prices", async () => {
    const { service, tx } = setup(null);
    await expect(
      service.create(dto, "request-key-123456", "cashier"),
    ).rejects.toThrow();
    expect(tx.order.create).not.toHaveBeenCalled();
  });
  it("requires phone and address for delivery", async () => {
    const { service } = setup();
    await expect(
      service.create(
        { ...dto, fulfillment: "DELIVERY" },
        "request-key-123456",
        "cashier",
      ),
    ).rejects.toThrow();
  });
});
