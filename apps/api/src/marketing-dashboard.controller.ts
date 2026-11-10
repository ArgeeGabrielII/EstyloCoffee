import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { StoreHoursService, businessDateValue, previousBusinessDay } from "./store-hours.service";

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Controller("reports/marketing-dashboard")
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MarketingDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hours: StoreHoursService,
  ) {}

  @Get()
  async getDashboard() {
    const now = new Date();
    const window = await this.hours.current(now);
    const currentDate = businessDateValue(window.businessDate);
    const previousDate = businessDateValue(previousBusinessDay(window.businessDate));
    const currentStart = new Date(window.startedAt);
    const previousStart = new Date(currentStart.getTime() - DAY_MS);
    const elapsed = now.getTime() - currentStart.getTime();
    const previousComparableEnd = new Date(previousStart.getTime() + elapsed);

    const orders = await this.prisma.order.findMany({
      where: {
        businessDate: { in: [currentDate, previousDate] },
        payment: "PAID",
        status: { not: "CANCELLED" },
      },
      select: { businessDate: true, createdAt: true, totalCentavos: true },
    });

    let todaySalesCentavos = 0;
    let yesterdayComparableCentavos = 0;
    let todayOrders = 0;
    const hourlyCounts = Array.from({ length: 24 }, () => 0);
    for (const order of orders) {
      if (order.businessDate.getTime() === currentDate.getTime()) {
        todaySalesCentavos += order.totalCentavos;
        todayOrders += 1;
        const hour = new Date(order.createdAt.getTime() + PH_OFFSET_MS).getUTCHours();
        hourlyCounts[hour] += 1;
      } else if (order.createdAt < previousComparableEnd) {
        yesterdayComparableCentavos += order.totalCentavos;
      }
    }

    const growthPercent = yesterdayComparableCentavos > 0
      ? Math.round(((todaySalesCentavos - yesterdayComparableCentavos)
        / yesterdayComparableCentavos) * 1000) / 10
      : null;
    const maxCount = Math.max(...hourlyCounts);
    const peakHour = maxCount > 0 ? hourlyCounts.indexOf(maxCount) : null;

    return {
      asOf: now.toISOString(),
      businessDate: window.businessDate,
      rolloverAt: window.rolloverAt,
      todaySalesCentavos,
      yesterdayComparableCentavos,
      growthPercent,
      todayOrders,
      peakHour,
      peakOrderCount: maxCount,
      comparison: "Current business day vs. matching elapsed time of prior business day (Asia/Manila)",
      hourBasis: "Order creation time, Asia/Manila",
    };
  }
}
