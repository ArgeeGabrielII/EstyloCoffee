import {
  BadRequestException, Body, ConflictException, Controller, Get, Post,
  Put, Query, UseGuards,
} from "@nestjs/common";
import { Equals, IsInt, Matches, Max, Min } from "class-validator";
import { UserRole } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { AuthUser, CurrentUser } from "./common/current-user.decorator";
import {
  StoreHoursService, businessDateValue, businessDayFor, validateHours,
} from "./store-hours.service";
import { lockBusinessDay } from "./business-day-lock";

class StoreHoursDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) openingTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) closingTime!: string;
  @IsInt() @Min(0) @Max(360) bufferMinutes!: number;
}
class FinalizeDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) businessDate!: string;
  @Equals("FINALIZE") confirmation!: string;
}
const unfinished = ["NEW", "PREPARING", "READY"] as const;

@Controller("store-hours")
@UseGuards(AuthGuard, RolesGuard)
export class StoreHoursController {
  constructor(private readonly prisma: PrismaService, private readonly service: StoreHoursService) {}

  @Get("current")
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  current() { return this.service.current(); }

  @Get("reconciliation")
  @Roles(UserRole.ADMIN)
  async reconciliation(@Query("date") date?: string) {
    const window = await this.service.current();
    const day = date ?? window.businessDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(businessDateValue(day).getTime())
        || day > window.businessDate) {
      throw new BadRequestException("Invalid or future business date");
    }
    const businessDate = businessDateValue(day);
    const where = { businessDate };
    const [snapshot, orderCount, paid, unpaidOrderCount, unfinishedCount] = await this.prisma.$transaction([
      this.prisma.businessDayClose.findUnique({ where: { businessDate } }),
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where: { ...where, payment: "PAID" as const, status: { not: "CANCELLED" as const } },
        _count: true,
        _sum: { totalCentavos: true },
      }),
      this.prisma.order.count({ where: { ...where, payment: "UNPAID", status: { not: "CANCELLED" } } }),
      this.prisma.order.count({ where: { ...where, status: { in: [...unfinished] } } }),
    ]);
    const locked = Boolean(snapshot) || day !== window.businessDate;
    return {
      businessDate: day, phase: day === window.businessDate ? window.phase : "PAST",
      rolloverAt: day === window.businessDate ? window.rolloverAt : null,
      locked, lockReason: snapshot ? "MANUALLY_FINALIZED" : locked ? "ROLLOVER" : "OPEN",
      orderCount, paidOrderCount: paid._count, salesCentavos: paid._sum.totalCentavos ?? 0,
      unpaidOrderCount, unfinishedCount, snapshot,
    };
  }

  @Post("finalize")
  @Roles(UserRole.ADMIN)
  async finalize(@Body() dto: FinalizeDto, @CurrentUser() actor: AuthUser) {
    return this.prisma.$transaction(async tx => {
      const settings = await tx.storeHours.findUnique({ where: { id: 1 } });
      if (!settings) throw new ConflictException("Store hours are not configured");
      const now = new Date();
      const window = await this.service.current(now);
      if (window.phase !== "REVIEW" || window.businessDate !== dto.businessDate) {
        throw new ConflictException("Financial finalization is permitted only during this business day's review window");
      }
      await lockBusinessDay(tx, dto.businessDate);
      const lockedAt = new Date();
      const current = await this.service.current(lockedAt);
      if (current.phase !== "REVIEW" || current.businessDate !== dto.businessDate) {
        throw new ConflictException("Review window has ended; financial records are already locked by rollover");
      }
      const date = businessDateValue(dto.businessDate);
      const existing = await tx.businessDayClose.findUnique({ where: { businessDate: date } });
      if (existing) return existing;
      const where = { businessDate: date };
      const [orderCount, paid, unpaidOrderCount, unfinishedCount] = await Promise.all([
        tx.order.count({ where }),
        tx.order.aggregate({
          where: { ...where, payment: "PAID", status: { not: "CANCELLED" } },
          _count: true, _sum: { totalCentavos: true },
        }),
        tx.order.count({ where: { ...where, payment: "UNPAID", status: { not: "CANCELLED" } } }),
        tx.order.count({ where: { ...where, status: { in: [...unfinished] } } }),
      ]);
      if (unpaidOrderCount || unfinishedCount) {
        throw new ConflictException(
          `Resolve ${unpaidOrderCount} unpaid and ${unfinishedCount} unfinished orders before finalizing. Rollover will still lock the day at the scheduled cutoff.`,
        );
      }
      const snapshot = await tx.businessDayClose.create({
        data: {
          businessDate: date, finalizedBy: actor.id, orderCount,
          paidOrderCount: paid._count, salesCentavos: paid._sum.totalCentavos ?? 0,
          unpaidOrderCount, unfinishedCount,
        },
      });
      await tx.auditLog.create({
        data: { event: "BUSINESS_DAY_FINALIZED", entityId: dto.businessDate, userId: actor.id },
      });
      return snapshot;
    });
  }

  @Put()
  @Roles(UserRole.ADMIN)
  async update(@Body() dto: StoreHoursDto, @CurrentUser() actor: AuthUser) {
    try { validateHours(dto); }
    catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid hours");
    }
    const before = await this.service.current();
    if (before.phase === "REVIEW") {
      throw new ConflictException("Schedule cannot be changed during reconciliation");
    }
    // A revised schedule must not move the live date backward or reopen old sales.
    if (businessDayFor(new Date(), dto) < before.businessDate) {
      throw new ConflictException("This change would reopen a previously closed business day. Choose a schedule that does not move the business date backward.");
    }
    await this.prisma.$transaction(async tx => {
      await tx.storeHours.upsert({
        where: { id: 1 },
        create: { id: 1, ...dto },
        update: { ...dto },
      });
      await tx.auditLog.create({
        data: { event: "STORE_HOURS_UPDATED", entityId: "store-hours", userId: actor.id },
      });
    });
    return this.service.current();
  }
}
