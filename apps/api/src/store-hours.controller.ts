import { BadRequestException, Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { IsInt, Matches, Max, Min } from "class-validator";
import { UserRole } from "@prisma/client";
import { PrismaService } from "./prisma/prisma.service";
import { AuthGuard } from "./auth/auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { Roles } from "./common/roles.decorator";
import { AuthUser, CurrentUser } from "./common/current-user.decorator";
import { StoreHoursService, validateHours } from "./store-hours.service";

class StoreHoursDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) openingTime!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) closingTime!: string;
  @IsInt() @Min(0) @Max(360) bufferMinutes!: number;
}
@Controller("store-hours")
@UseGuards(AuthGuard, RolesGuard)
export class StoreHoursController {
  constructor(private readonly prisma: PrismaService, private readonly service: StoreHoursService) {}

  @Get("current")
  @Roles(UserRole.ADMIN, UserRole.CASHIER)
  current() { return this.service.current(); }

  @Put()
  @Roles(UserRole.ADMIN)
  async update(@Body() dto: StoreHoursDto, @CurrentUser() actor: AuthUser) {
    try { validateHours(dto); }
    catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid hours");
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
