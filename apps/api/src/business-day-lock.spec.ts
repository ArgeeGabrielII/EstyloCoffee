import { assertFinancialDayOpen } from "./business-day-lock";
import { Prisma } from "@prisma/client";

function sample(dayClosed = false) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    storeHours: { findUnique: jest.fn().mockResolvedValue({
      openingTime: "14:00", closingTime: "01:00", bufferMinutes: 60,
    }) },
    businessDayClose: {
      findUnique: jest.fn().mockResolvedValue(dayClosed ? { businessDate: new Date("2026-11-10") } : null),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}
const at = (stamp: string) => new Date(stamp + "+08:00");
describe("Financial business-day locking", () => {
  it("permits paid changes during the 1:00–2:00 AM review hour", async () => {
    const tx = sample();
    await expect(assertFinancialDayOpen(tx, "2026-11-10", at("2026-11-11T01:59:00")))
      .resolves.toBeUndefined();
  });
  it("automatically prevents yesterday's payment after the 2:00 AM rollover", async () => {
    const tx = sample();
    await expect(assertFinancialDayOpen(tx, "2026-11-10", at("2026-11-11T02:00:00")))
      .rejects.toThrow(/reconciliation cutoff/);
  });
  it("respects manual close before 2:00 AM", async () => {
    const tx = sample(true);
    await expect(assertFinancialDayOpen(tx, "2026-11-10", at("2026-11-11T01:15:00")))
      .rejects.toThrow(/finalized/);
  });
  it("allows the next business day after rollover", async () => {
    const tx = sample();
    await expect(assertFinancialDayOpen(tx, "2026-11-11", at("2026-11-11T14:00:00")))
      .resolves.toBeUndefined();
  });
});
