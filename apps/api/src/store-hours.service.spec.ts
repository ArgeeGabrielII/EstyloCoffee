import { businessDateValue, businessDayFor, businessDayWindow, validateHours } from "./store-hours.service";

const hours = { openingTime: "08:00", closingTime: "18:00", bufferMinutes: 60 };
function time(day: string, hhmm: string): Date { return new Date(`${day}T${hhmm}:00+08:00`); }

describe("store business-day rollover (Asia/Manila)", () => {
  it("keeps the just-closed day visible during the review buffer", () => {
    expect(businessDayFor(time("2026-11-10", "18:59"), hours)).toBe("2026-11-10");
    expect(businessDayWindow(time("2026-11-10", "18:01"), hours).phase).toBe("REVIEW");
    expect(businessDayFor(time("2026-11-10", "19:00"), hours)).toBe("2026-11-11");
    expect(businessDayWindow(time("2026-11-10", "19:00"), hours).phase).toBe("CLOSED");
    expect(businessDayWindow(time("2026-11-10", "12:00"), hours).phase).toBe("OPEN");
  });
  it("supports closing after midnight and rolls at 03:00", () => {
    const overnight = { openingTime: "20:00", closingTime: "02:00", bufferMinutes: 60 };
    expect(businessDayFor(time("2026-11-11", "02:59"), overnight)).toBe("2026-11-10");
    expect(businessDayFor(time("2026-11-11", "03:00"), overnight)).toBe("2026-11-11");
  });
  it("supports Estylo's 2 PM to 1 AM shift, 1-2 AM reconciliation", () => {
    const schedule = { openingTime: "14:00", closingTime: "01:00", bufferMinutes: 60 };
    expect(() => validateHours(schedule)).not.toThrow();

    for (const [date, clock, businessDate, phase] of [
      ["2026-11-10", "13:59", "2026-11-10", "CLOSED"],
      ["2026-11-10", "14:00", "2026-11-10", "OPEN"],
      ["2026-11-10", "23:59", "2026-11-10", "OPEN"],
      ["2026-11-11", "00:00", "2026-11-10", "OPEN"],
      ["2026-11-11", "00:59", "2026-11-10", "OPEN"],
      ["2026-11-11", "01:00", "2026-11-10", "REVIEW"],
      ["2026-11-11", "01:59", "2026-11-10", "REVIEW"],
      ["2026-11-11", "02:00", "2026-11-11", "CLOSED"],
      ["2026-11-11", "02:01", "2026-11-11", "CLOSED"],
      ["2026-11-11", "13:59", "2026-11-11", "CLOSED"],
      ["2026-11-11", "14:00", "2026-11-11", "OPEN"],
    ] as const) {
      const when = time(date, clock);
      const result = businessDayWindow(when, schedule);
      expect(result.businessDate).toBe(businessDate);
      expect(result.phase).toBe(phase);
      expect(businessDayFor(when, schedule)).toBe(businessDate);
    }

    const beforeRollover = businessDayWindow(time("2026-11-11", "01:59"), schedule);
    expect(beforeRollover.closingAt).toBe("2026-11-10T17:00:00.000Z");
    expect(beforeRollover.rolloverAt).toBe("2026-11-10T18:00:00.000Z");

    const afterRollover = businessDayWindow(time("2026-11-11", "02:00"), schedule);
    expect(afterRollover.closingAt).toBe("2026-11-11T17:00:00.000Z");
    expect(afterRollover.rolloverAt).toBe("2026-11-11T18:00:00.000Z");
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
