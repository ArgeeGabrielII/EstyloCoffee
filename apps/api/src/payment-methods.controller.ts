import { BadRequestException, ConflictException, Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { IsBoolean, IsString, MaxLength, MinLength } from "class-validator";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { AuthUser, CurrentUser } from "./common/current-user.decorator";

class PaymentMethodDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsBoolean() active!: boolean;
}

@Controller("payment-methods")
@UseGuards(AuthGuard, RolesGuard)
export class PaymentMethodsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  list() {
    return this.prisma.paymentMethod.findMany({ orderBy: { name: "asc" } });
  }

  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: PaymentMethodDto, @CurrentUser() actor: AuthUser) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Payment method name required");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const method = await tx.paymentMethod.create({ data: { name, active: dto.active } });
        await tx.auditLog.create({ data: { event: "PAYMENT_METHOD_CREATED", entityId: method.id, userId: actor.id } });
        return method;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Payment method name already exists");
      throw error;
    }
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  async update(@Param("id") id: string, @Body() dto: PaymentMethodDto, @CurrentUser() actor: AuthUser) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException("Payment method name required");
    try {
      return await this.prisma.$transaction(async (tx) => {
        const method = await tx.paymentMethod.update({ where: { id }, data: { name, active: dto.active } });
        await tx.auditLog.create({ data: { event: "PAYMENT_METHOD_UPDATED", entityId: method.id, userId: actor.id } });
        return method;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("Payment method name already exists");
      throw error;
    }
  }
}
