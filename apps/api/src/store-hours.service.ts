import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";

// Business days are anchored in Philippine Time; all database date values are UTC midnight.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export type Hours = { openingTime: string; closingTime: string; bufferMinutes: number };
export const DEFAULT_HOURS: Hours = { openingTime: "00:00", closingTime: "23:00", bufferMinutes: 60 };

export function minutes(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw Error("Use HH:mm (24-hour clock)");
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function validateHours(settings: Hours): void {
  const opening = minutes(settings.openingTime);
  const closing = minutes(settings.closingTime);
  if (!Number.isInteger(settings.bufferMinutes) || settings.bufferMinutes < 0 || settings.bufferMinutes > 360)
    throw Error("Review buffer must be between 0 and 360 minutes");
  const duration = (closing - opening + 1440) % 1440 || 1440;
  if (duration + settings.bufferMinutes > 1440)
    throw Error("Closing time plus review buffer must finish before the next opening");
}

function utcMidnightOfManilaDay(now: Date): number {
  const local = new Date(now.getTime() + PH_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}
function cutoffMinute(settings: Hours): number {
  const opening = minutes(settings.openingTime);
  const closing = minutes(settings.closingTime);
  return closing + (closing <= opening ? 1440 : 0) + settings.bufferMinutes;
}
function dateString(utcMidnight: number): string {
  return new Date(utcMidnight).toISOString().slice(0, 10);
}
export function businessDayFor(now: Date, settings: Hours): string {
  const today = utcMidnightOfManilaDay(now);
  const todayCutoff = today - PH_OFFSET_MS + cutoffMinute(settings) * 60000;
  const yesterdayCutoff = todayCutoff - DAY_MS;
  return dateString(now.getTime() >= todayCutoff ? today + DAY_MS
    : now.getTime() < yesterdayCutoff ? today - DAY_MS : today);
}
export function businessDateValue(day: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw Error("Invalid business date");
  return new Date(day + "T00:00:00.000Z");
}
export function previousBusinessDay(day: string): string {
  return dateString(businessDateValue(day).getTime() - DAY_MS);
}
function dayCutoff(day: string, settings: Hours, includeBuffer: boolean): Date {
  const dayStartManila = businessDateValue(day).getTime() - PH_OFFSET_MS;
  const closing = minutes(settings.closingTime);
  const opening = minutes(settings.openingTime);
  return new Date(dayStartManila + (closing + (closing <= opening ? 1440 : 0)
    + (includeBuffer ? settings.bufferMinutes : 0)) * 60000);
}
export function businessDayWindow(now: Date, settings: Hours) {
  const businessDate = businessDayFor(now, settings);
  const priorDay = previousBusinessDay(businessDate);
  const closingAt = dayCutoff(businessDate, settings, false);
  const rolloverAt = dayCutoff(businessDate, settings, true);
  const startedAt = dayCutoff(priorDay, settings, true);
  const review = now >= closingAt && now < rolloverAt;
  const localMinute = Math.floor(((now.getTime() + PH_OFFSET_MS) % DAY_MS) / 60000);
  const opens = minutes(settings.openingTime);
  const closes = minutes(settings.closingTime);
  const isOpen = closes <= opens ? localMinute >= opens || localMinute < closes
    : localMinute >= opens && localMinute < closes;
  return {
    businessDate,
    startedAt: startedAt.toISOString(),
    closingAt: closingAt.toISOString(),
    rolloverAt: rolloverAt.toISOString(),
    phase: review ? "REVIEW" : isOpen ? "OPEN" : "CLOSED",
    isOpen,
    ...settings,
    timeZone: "Asia/Manila",
  };
}

@Injectable()
export class StoreHoursService {
  constructor(private readonly prisma: PrismaService) {}
  async settings(): Promise<Hours> {
    const row = await this.prisma.storeHours.findUnique({ where: { id: 1 } });
    return row ?? DEFAULT_HOURS;
  }
  async current(now = new Date()) {
    const settings = await this.settings();
    return businessDayWindow(now, settings);
  }
}
