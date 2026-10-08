import { transition } from "./order-rules";
describe("Order workflow", () => {
  it("supports valid preparation and paid completion", () => {
    expect(
      transition({ status: "NEW", payment: "UNPAID" }, { status: "PREPARING" })
        .status,
    ).toBe("PREPARING");
    expect(
      transition(
        { status: "READY", payment: "UNPAID" },
        { status: "COMPLETED", payment: "PAID" },
      ),
    ).toEqual({ status: "COMPLETED", payment: "PAID" });
  });
  it("rejects skipped steps, unpaid completion and payment reversal", () => {
    expect(() =>
      transition({ status: "NEW", payment: "UNPAID" }, { status: "READY" }),
    ).toThrow();
    expect(() =>
      transition(
        { status: "READY", payment: "UNPAID" },
        { status: "COMPLETED" },
      ),
    ).toThrow();
    expect(() =>
      transition(
        { status: "COMPLETED", payment: "PAID" },
        { payment: "UNPAID" },
      ),
    ).toThrow();
  });
  it("does not charge cancelled orders or cancel paid orders", () => {
    expect(() =>
      transition(
        { status: "CANCELLED", payment: "UNPAID" },
        { payment: "PAID" },
      ),
    ).toThrow();
    expect(() =>
      transition(
        { status: "PREPARING", payment: "PAID" },
        { status: "CANCELLED" },
      ),
    ).toThrow();
  });
});
