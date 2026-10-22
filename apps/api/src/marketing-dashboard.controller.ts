import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Controller("reports/marketing-dashboard")
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class MarketingDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getDashboard() {
    const now = new Date();
    // Manila does not use daylight saving time.
    const manilaNow = new Date(now.getTime() + PH_OFFSET_MS);
    const todayStart = new Date(
      Date.UTC(
        manilaNow.getUTCFullYear(),
        manilaNow.getUTCMonth(),
        manilaNow.getUTCDate(),
      ) - PH_OFFSET_MS,
    );
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
    const elapsedMs = now.getTime() - todayStart.getTime();
    const yesterdaySameTime = new Date(yesterdayStart.getTime() + elapsedMs);

    // Only paid, non-cancelled orders count as sales.
    // Attribute sales to order creation time, matching the existing sales reports.
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: yesterdayStart, lte: now },
        payment: "PAID",
        status: { not: "CANCELLED" },
      },
      select: { createdAt: true, totalCentavos: true },
    });

    let todaySalesCentavos = 0;
    let yesterdayComparableCentavos = 0;
    let todayOrders = 0;
    const hourlyCounts = Array.from({ length: 24 }, () => 0);

    for (const order of orders) {
      const when = order.createdAt.getTime();
      if (when >= todayStart.getTime()) {
        todaySalesCentavos += order.totalCentavos;
        todayOrders += 1;
        const hour = new Date(when + PH_OFFSET_MS).getUTCHours();
        hourlyCounts[hour] += 1;
      } else if (when < yesterdaySameTime.getTime()) {
        yesterdayComparableCentavos += order.totalCentavos;
      }
    }

    const growthPercent =
      yesterdayComparableCentavos > 0
        ? Math.round(
            ((todaySalesCentavos - yesterdayComparableCentavos) /
              yesterdayComparableCentavos) * 1000,
          ) / 10
        : null;

    const maxCount = Math.max(...hourlyCounts);
    const peakHour = maxCount > 0 ? hourlyCounts.indexOf(maxCount) : null;

    return {
      asOf: now.toISOString(),
      todaySalesCentavos,
      yesterdayComparableCentavos,
      growthPercent,
      todayOrders,
      peakHour,
      peakOrderCount: maxCount,
      comparison: "Today versus the same elapsed hours yesterday (Asia/Manila)",
      hourBasis: "Order creation time, Asia/Manila",
    };
  }
}
