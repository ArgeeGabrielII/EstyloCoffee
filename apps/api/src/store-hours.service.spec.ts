import { businessDateValue, businessDayFor, businessDayWindow, validateHours } from "./store-hours.service";

const hours = { openingTime: "08:00", closingTime: "18:00", bufferMinutes: 60 };
function time(day: string, hhmm: string): Date { return new Date(`${day}T${hhmm}:00+08:00`); }

describe("store business-day rollover (Asia/Manila)", () => {
  it("keeps the just-closed day visible during the review buffer", () => {
    expect(businessDayFor(time("2026-11-10", "18:59"), hours)).toBe("2026-11-10");
    expect(businessDayWindow(time("2026-11-10", "18:01"), hours).phase).toBe("REVIEW");
    expect(businessDayFor(time("2026-11-10", "19:00"), hours)).toBe("2026-11-11");
    expect(businessDayWindow(time("2026-11-10", "19:00"), hours).phase).toBe("NORMAL");
  });
  it("supports closing after midnight and rolls at 03:00", () => {
    const overnight = { openingTime: "20:00", closingTime: "02:00", bufferMinutes: 60 };
    expect(businessDayFor(time("2026-11-11", "02:59"), overnight)).toBe("2026-11-10");
    expect(businessDayFor(time("2026-11-11", "03:00"), overnight)).toBe("2026-11-11");
  });
  it("defaults to midnight and has stable UTC-date storage", () => {
    const defaults = { openingTime: "00:00", closingTime: "23:00", bufferMinutes: 60 };
    expect(businessDayFor(time("2026-11-10", "23:59"), defaults)).toBe("2026-11-10");
    expect(businessDayFor(time("2026-11-11", "00:00"), defaults)).toBe("2026-11-11");
    expect(businessDateValue("2026-11-11").toISOString()).toBe("2026-11-11T00:00:00.000Z");
  });
  it("rejects overlap and out-of-range buffer", () => {
    expect(() => validateHours({openingTime:"08:00", closingTime:"07:00",bufferMinutes:120})).toThrow();
    expect(() => validateHours({openingTime:"08:00", closingTime:"18:00",bufferMinutes:361})).toThrow();
    expect(() => validateHours({openingTime:"08:00", closingTime:"18:00",bufferMinutes:0})).not.toThrow();
  });
});
