import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { AuthUser, CurrentUser } from "./common/current-user.decorator";
import {
  ActiveDto,
  AddonDto,
  OrderDto,
  ProductDto,
  UpdateOrderDto,
  UserDto,
} from "./coffee.dto";
import { CoffeeService } from "./coffee.service";

const selectUser = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  active: true,
};

@Controller()
@UseGuards(AuthGuard, RolesGuard)
export class CoffeeController {
  constructor(
    private p: PrismaService,
    private coffee: CoffeeService,
  ) {}

  @Get("products")
  products() {
    return this.p.product.findMany({ orderBy: { name: "asc" } });
  }

  @Patch("products/:id")
  @Roles(UserRole.ADMIN)
  product(
    @Param("id") id: string,
    @Body() dto: ProductDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.p.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id }, data: dto });

      await tx.auditLog.create({
        data: {
          event: "PRODUCT_UPDATED",
          entityId: id,
          userId: u.id,
        },
      });

      return p;
    });
  }

  @Get("addons")
  addons() {
    return this.p.addon.findMany({ orderBy: { name: "asc" } });
  }

  @Post("addons")
  @Roles(UserRole.ADMIN)
  createAddon(@Body() dto: AddonDto, @CurrentUser() u: AuthUser) {
    return this.p.$transaction(async (tx) => {
      const addon = await tx.addon.create({
        data: { ...dto, name: dto.name.trim() },
      });

      await tx.auditLog.create({
        data: {
          event: "ADDON_CREATED",
          entityId: addon.id,
          userId: u.id,
        },
      });

      return addon;
    });
  }

  @Patch("addons/:id")
  @Roles(UserRole.ADMIN)
  updateAddon(
    @Param("id") id: string,
    @Body() dto: AddonDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.p.$transaction(async (tx) => {
      const addon = await tx.addon.update({
        where: { id },
        data: { ...dto, name: dto.name.trim() },
      });

      await tx.auditLog.create({
        data: {
          event: "ADDON_UPDATED",
          entityId: id,
          userId: u.id,
        },
      });

      return addon;
    });
  }

  @Get("orders")
  async orders(@Query("page") page = "1") {
    const n = Number(page);

    if (!Number.isInteger(n) || n < 1) {
      throw new BadRequestException("Invalid page");
    }

    const [rows, total] = await this.p.$transaction([
      this.p.order.findMany({
        orderBy: { createdAt: "desc" },
        skip: (n - 1) * 50,
        take: 50,
        include: {
          items: { include: { addons: true } },
          user: { select: { displayName: true } },
        },
      }),
      this.p.order.count(),
    ]);

    return { rows, total, page: n };
  }

  @Post("orders")
  create(
    @Body() dto: OrderDto,
    @Headers("idempotency-key") key: string,
    @CurrentUser() u: AuthUser,
  ) {
    return this.coffee.create(dto, key, u.id);
  }

  @Patch("orders/:id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() u: AuthUser,
  ) {
    return this.coffee.update(id, dto, u.id);
  }

  @Get("users")
  @Roles(UserRole.ADMIN)
  users() {
    return this.p.user.findMany({
      select: selectUser,
      orderBy: { username: "asc" },
    });
  }

  @Post("users")
  @Roles(UserRole.ADMIN)
  async createUser(
    @Body() dto: UserDto,
    @CurrentUser() u: AuthUser,
  ) {
    try {
      return await this.p.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            username: dto.username,
            displayName: dto.displayName,
            role: dto.role,
            passwordHash: await argon2.hash(dto.password),
          },
          select: selectUser,
        });

        await tx.auditLog.create({
          data: {
            event: "USER_CREATED",
            entityId: user.id,
            userId: u.id,
          },
        });

        return user;
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Username exists");
      }

      throw e;
    }
  }

  @Patch("users/:id")
  @Roles(UserRole.ADMIN)
  active(
    @Param("id") id: string,
    @Body() dto: ActiveDto,
    @CurrentUser() u: AuthUser,
  ) {
    if (id === u.id && !dto.active) {
      throw new BadRequestException("Cannot disable yourself");
    }

    return this.p.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: dto,
        select: selectUser,
      });

      await tx.auditLog.create({
        data: {
          event: "USER_ACTIVE_" + dto.active,
          entityId: id,
          userId: u.id,
        },
      });

      return user;
    });
  }

  @Get("audit")
  @Roles(UserRole.ADMIN)
  audit() {
    return this.p.auditLog.findMany({
      take: 200,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { displayName: true } } },
    });
  }

  @Get("reports")
  @Roles(UserRole.ADMIN)
  async reports(
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const end = to ? new Date(to) : new Date();
    const start = from
      ? new Date(from)
      : new Date(end.getTime() - 30 * 86400000);

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start > end ||
      end.getTime() - start.getTime() > 366 * 86400000
    ) {
      throw new BadRequestException("Invalid date range (max 366 days)");
    }

    const where = { createdAt: { gte: start, lte: end } };

    const [count, paid, open, statuses] = await this.p.$transaction([
      this.p.order.count({ where }),
      this.p.order.aggregate({
        where: {
          ...where,
          payment: "PAID",
          status: { not: "CANCELLED" },
        },
        _sum: { totalCentavos: true },
        _count: true,
      }),
      this.p.order.count({
        where: {
          ...where,
          status: { in: ["NEW", "PREPARING", "READY"] },
        },
      }),
      this.p.order.groupBy({
        by: ["status"],
        where,
        _count: true,
        orderBy: { status: "asc" },
      }),
    ]);

    return {
      from: start,
      to: end,
      count,
      paidCount: paid._count,
      paidCentavos: paid._sum.totalCentavos || 0,
      open,
      statuses,
    };
  }
}