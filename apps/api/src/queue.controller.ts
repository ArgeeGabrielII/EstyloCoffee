import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { UserRole } from "@prisma/client";

// Philippine time is UTC+08:00 throughout the year (no daylight saving time).
function manilaTodayStartUtc(now = new Date()): Date {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate())
    - 8 * 60 * 60 * 1000);
}

@Controller("queue")
export class QueueController {
  constructor(private p: PrismaService) {}

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
    const start = manilaTodayStartUtc();
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    // Return every order created today, plus *all* older unfinished orders.
    // Older completed/cancelled orders are intentionally excluded from this board.
    // No take:50 limit: busy days must not silently lose completed/cancelled entries.
    return this.p.order.findMany({
      where: {
        OR: [
          { createdAt: { gte: start, lt: end } },
          { createdAt: { lt: start }, status: { in: ["NEW", "PREPARING", "READY"] } },
        ],
      },
      include: { items: { include: { addons: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
