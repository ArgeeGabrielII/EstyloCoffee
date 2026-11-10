import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { CoffeeController } from "./coffee.controller";
import { AuditController } from "./audit.controller";
import { CoffeeService } from "./coffee.service";
import { HealthController } from "./health.controller";
import { QueueController } from "./queue.controller";
import { OnsiteController } from "./onsite.controller";
import { CupsReportController } from "./cups-report.controller";
import { PaymentMethodsController } from "./payment-methods.controller";
import { MarketingDashboardController } from "./marketing-dashboard.controller";
import { StoreHoursController } from "./store-hours.controller";
import { StoreHoursService } from "./store-hours.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    CoffeeController,
    AuditController,
    HealthController,
    QueueController,
    OnsiteController,
    CupsReportController,
    PaymentMethodsController,
    MarketingDashboardController,
    StoreHoursController,
  ],
  providers: [CoffeeService, StoreHoursService],
})
export class AppModule {}
