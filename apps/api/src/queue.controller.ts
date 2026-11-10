import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { UserRole } from "@prisma/client";
import { StoreHoursService, businessDateValue } from "./store-hours.service";

@Controller("queue")
export class QueueController {
  constructor(private p: PrismaService, private hours: StoreHoursService) {}

  @Get("public")
  publicQueue() {
    return this.p.order.findMany({
      where: { status: { in: ["NEW", "PREPARING", "READY"] } },
      select: { id: true, customer: true, queueNumber: true, status: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  @Get("staff")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  async staffQueue() {
    const { businessDate } = await this.hours.current();
    const currentDate = businessDateValue(businessDate);
    // Current business-date orders plus older unfinished orders.
    // Historical completed/cancelled orders remain accessible through reports.
    // No take:50 limit: busy days must not silently lose completed/cancelled entries.
    return this.p.order.findMany({
      where: {
        OR: [
          { businessDate: currentDate },
          { businessDate: { lt: currentDate }, status: { in: ["NEW", "PREPARING", "READY"] } },
        ],
      },
      include: { items: { include: { addons: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
