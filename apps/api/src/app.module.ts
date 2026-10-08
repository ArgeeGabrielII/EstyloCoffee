import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { CoffeeController } from "./coffee.controller";
import { CoffeeService } from "./coffee.service";
import { HealthController } from "./health.controller";
import { QueueController } from "./queue.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    CoffeeController,
    HealthController,
    QueueController,
  ],
  providers: [CoffeeService],
})
export class AppModule {}