import { Controller, Get, UseGuards } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("queue")
export class QueueController {
  constructor(private p: PrismaService) {}

  @Get("public")
  publicQueue() {
    return this.p.order.findMany({
      where: {
        status: { in: ["NEW", "PREPARING", "READY"] },
      },
      select: {
        id: true,
        customer: true,
        status: true,
      },
      orderBy: [
        { createdAt: "asc" },
        { id: "asc" },
      ],
    });
  }

  @Get("staff")
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  async staffQueue() {
    const include = {
      items: { include: { addons: true } },
    };

    const [pending, history] = await this.p.$transaction([
      this.p.order.findMany({
        where: {
          status: { in: ["NEW", "PREPARING", "READY"] },
        },
        include,
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      }),
      this.p.order.findMany({
        where: {
          status: { in: ["COMPLETED", "CANCELLED"] },
        },
        include,
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    return [...pending, ...history];
  }
}