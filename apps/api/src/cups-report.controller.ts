
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

type SaleRow = {
  date: string;
  productId: string;
  name: string;
  quantity: number;
  freeCups: number;
  coffeeSalesCentavos: number;
  addonSalesCentavos: number;
  salesCentavos: number;
};

type AddonSaleRow = {
  date: string;
  productId: string;
  addonId: string;
  name: string;
  quantity: number;
  salesCentavos: number;
};

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

    // Philippine Time (UTC+8).
    // Start inclusive, end exclusive.
    const offsetMs = 8 * 60 * 60 * 1000;
    const startMonth = month ?? 1;
    const endMonth = month ?? 12;

    const start = new Date(
      Date.UTC(year, startMonth - 1, 1) - offsetMs
    );

    const end = new Date(
      Date.UTC(year, endMonth, 1) - offsetMs
    );

    const [products, orders] = await Promise.all([
      this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      this.prisma.order.findMany({
        where: {
          payment: "PAID",
          status: {
            not: "CANCELLED",
          },
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
              freeDrink: true,
              addons: {
                select: {
                  addonId: true,
                  name: true,
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

    const coffeeTotals = new Map<string, SaleRow>();
    const addonTotals = new Map<string, AddonSaleRow>();

    const productNames = new Map<string, string>(
      products.map((product) => [
        product.id,
        product.name,
      ])
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
        month === undefined
          ? date.slice(0, 7)
          : date;

      for (const item of order.items) {
        // Free cups are counted by quantity,
        // not by the number of order lines.
        const freeCups = item.freeDrink
          ? item.quantity
          : 0;

        // Free drinks have zero base coffee revenue.
        const coffeeSalesCentavos =
          item.quantity *
          (item.freeDrink ? 0 : item.unitPriceCentavos);

        // Add-ons remain chargeable for free drinks.
        const addonSalesCentavos =
          item.quantity *
          item.addons.reduce(
            (sum, addon) =>
              sum +
              addon.quantity * addon.unitPriceCentavos,
            0
          );

        const salesCentavos =
          coffeeSalesCentavos + addonSalesCentavos;

        const coffeeKey =
          `${period}|${item.productId}`;

        const existingCoffee =
          coffeeTotals.get(coffeeKey);

        if (existingCoffee) {
          existingCoffee.quantity += item.quantity;
          existingCoffee.freeCups += freeCups;
          existingCoffee.coffeeSalesCentavos +=
            coffeeSalesCentavos;
          existingCoffee.addonSalesCentavos +=
            addonSalesCentavos;
          existingCoffee.salesCentavos +=
            salesCentavos;
        } else {
          coffeeTotals.set(coffeeKey, {
            date: period,
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            freeCups,
            coffeeSalesCentavos,
            addonSalesCentavos,
            salesCentavos,
          });
        }

        // Keep historical product names available
        // even if a product is removed from the menu.
        if (!productNames.has(item.productId)) {
          productNames.set(item.productId, item.name);
        }

        for (const addon of item.addons) {
          // Add-on quantity is per cup.
          const quantity =
            addon.quantity * item.quantity;

          const addonRevenue =
            quantity * addon.unitPriceCentavos;

          const addonKey =
            `${period}|${item.productId}|${addon.addonId}`;

          const existingAddon =
            addonTotals.get(addonKey);

          if (existingAddon) {
            existingAddon.quantity += quantity;
            existingAddon.salesCentavos +=
              addonRevenue;
          } else {
            addonTotals.set(addonKey, {
              date: period,
              productId: item.productId,
              addonId: addon.addonId,
              name: addon.name,
              quantity,
              salesCentavos: addonRevenue,
            });
          }
        }
      }
    }

    return {
      year,
      month: month ?? null,

      products: Array.from(
        productNames,
        ([id, name]) => ({
          id,
          name,
        })
      ).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),

      sales: Array.from(coffeeTotals.values()).sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.name.localeCompare(b.name)
      ),

      addonSales: Array.from(addonTotals.values()).sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.productId.localeCompare(b.productId) ||
          a.name.localeCompare(b.name)
      ),
    };
  }
}
