import { StoreHoursController } from "./store-hours.controller";
import { PrismaService } from "./prisma/prisma.service";
import { StoreHoursService } from "./store-hours.service";
import { AuthUser } from "./common/current-user.decorator";

const operator = { id: "admin-id" } as AuthUser;
function setup(unpaidOrderCount = 0, unfinishedCount = 0) {
  const tx = {
    storeHours: { findUnique: jest.fn().mockResolvedValue({ id: 1, openingTime: "14:00", closingTime: "01:00", bufferMinutes: 60 }) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    businessDayClose: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ businessDate: new Date("2026-11-10"), orderCount: 4, paidOrderCount: 4 }),
    },
    order: {
      count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(unpaidOrderCount).mockResolvedValueOnce(unfinishedCount),
      aggregate: jest.fn().mockResolvedValue({ _count: 4, _sum: { totalCentavos: 45000 } }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const db = { $transaction: async (callback: (client: typeof tx) => unknown) => callback(tx) };
  const window = { businessDate: "2026-11-10", phase: "REVIEW" };
  const hours = { current: jest.fn().mockResolvedValue(window) };
  const controller = new StoreHoursController(db as unknown as PrismaService, hours as unknown as StoreHoursService);
  return { controller, tx, hours };
}
describe("admin financial finalization", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-11T01:30:00+08:00"));
  });
  afterEach(() => jest.useRealTimers());

  it("creates one snapshot and audit entry when there are no unresolved orders", async () => {
    const { controller, tx } = setup();
    await controller.finalize({ businessDate: "2026-11-10", confirmation: "FINALIZE" }, operator);
    expect(tx.businessDayClose.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        finalizedBy: "admin-id", paidOrderCount: 4, salesCentavos: 45000,
      }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ event: "BUSINESS_DAY_FINALIZED", entityId: "2026-11-10" }),
    }));
  });
  it("rejects finalization with outstanding unpaid orders", async () => {
    const { controller, tx } = setup(2);
    await expect(controller.finalize({ businessDate: "2026-11-10", confirmation: "FINALIZE" }, operator))
      .rejects.toThrow(/Resolve 2 unpaid/);
    expect(tx.businessDayClose.create).not.toHaveBeenCalled();
  });
  it("only finalizes during review window", async () => {
    const { controller, hours, tx } = setup();
    jest.setSystemTime(new Date("2026-11-11T02:01:00+08:00"));
    await expect(controller.finalize({ businessDate: "2026-11-10", confirmation: "FINALIZE" }, operator))
      .rejects.toThrow(/review window/);
    expect(tx.businessDayClose.create).not.toHaveBeenCalled();
  });
});
