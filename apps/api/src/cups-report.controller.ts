
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";

@Controller("reports/cups")
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class CupsReportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getReport(
    @Query("year") yearParam?: string,
    @Query("month") monthParam?: string
  ) {
    const year = Number(yearParam);
    const month =
      monthParam === undefined
        ? undefined
        : Number(monthParam);

    if (
      !yearParam ||
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      throw new BadRequestException("Invalid year");
    }

    if (
      month !== undefined &&
      (!Number.isInteger(month) || month < 1 || month > 12)
    ) {
      throw new BadRequestException("Invalid month");
    }

    const startMonth = month ?? 1;
    const endMonth = month ?? 12;

    const offsetMs = 8 * 60 * 60 * 1000;

    const start = new Date(
      Date.UTC(year, startMonth - 1, 1) - offsetMs
    );

    const end = new Date(
      Date.UTC(year, endMonth, 1) - offsetMs
    );

    // Exclusive upper bound: first day of the next month.
    // Date.UTC normalizes month 12 to January of the next year.

    const [products, orders] = await Promise.all([
      this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.order.findMany({
        where: {
          payment: "PAID",
          status: { not: "CANCELLED" },
          createdAt: {
            gte: start,
            lt: end,
          },
        },
        select: {
          createdAt: true,
          items: {
            select: {
              productId: true,
              name: true,
              quantity: true,
              unitPriceCentavos: true,
              addons: {
                select: {
                  quantity: true,
                  unitPriceCentavos: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    type SaleRow = {
      date: string;
      productId: string;
      name: string;
      quantity: number;
      salesCentavos: number;
    };

    const totals = new Map<string, SaleRow>();
    const productNames = new Map<string, string>(
      products.map((p) => [p.id, p.name])
    );

    for (const order of orders) {
      const parts = formatter.formatToParts(order.createdAt);

      const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? "";

      const date = [
        get("year"),
        get("month"),
        get("day"),
      ].join("-");

      const period =
        month === undefined ? date.slice(0, 7) : date;

      for (const item of order.items) {
        const addOnPerCup = item.addons.reduce(
          (sum, addon) =>
            sum + addon.quantity * addon.unitPriceCentavos,
          0
        );

        const salesCentavos =
          item.quantity *
          (item.unitPriceCentavos + addOnPerCup);

        const key = `${period}|${item.productId}`;

        const previous = totals.get(key);

        if (previous) {
          previous.quantity += item.quantity;
          previous.salesCentavos += salesCentavos;
        } else {
          totals.set(key, {
            date: period,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            salesCentavos,
          });
        }

        // Preserve products that may no longer be active.
        if (!productNames.has(item.productId)) {
          productNames.set(item.productId, item.name);
        }
      }
    }

    return {
      year,
      month: month ?? null,
      products: Array.from(productNames, ([id, name]) => ({
        id,
        name,
      })).sort((a, b) => a.name.localeCompare(b.name)),
      sales: Array.from(totals.values()).sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.name.localeCompare(b.name)
      ),
    };
  }
}
