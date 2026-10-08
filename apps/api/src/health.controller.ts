import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
@Controller("health")
export class HealthController {
  constructor(private p: PrismaService) {}
  @Get() async health() {
    await this.p.product.count();
    return { status: "ok" };
  }
}
