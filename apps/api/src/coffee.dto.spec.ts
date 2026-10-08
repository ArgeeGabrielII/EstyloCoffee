import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { OrderDto, ProductDto } from "./coffee.dto";
describe("Request validation", () => {
  it("rejects invalid quantities and unknown client totals", async () => {
    const d = plainToInstance(OrderDto, {
      customer: "Kenji",
      phone: "",
      address: "",
      fulfillment: "PICKUP",
      source: "WALK_IN",
      totalCentavos: 1,
      items: [
        { productId: "b7360200-576e-4b34-8f60-979317e521af", quantity: 0 },
      ],
    });
    const errors = await validate(d, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(errors.some((e) => e.property === "items")).toBe(true);
    expect(errors.some((e) => e.property === "totalCentavos")).toBe(true);
  });
  it("rejects noninteger and zero prices", async () => {
    for (const priceCentavos of [0, 12.5])
      expect(
        (
          await validate(
            plainToInstance(ProductDto, { priceCentavos, active: true }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
});
