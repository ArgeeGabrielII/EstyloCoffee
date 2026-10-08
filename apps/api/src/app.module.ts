import { HealthController } from "./health.controller";
import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { CoffeeController } from "./coffee.controller";
import { CoffeeService } from "./coffee.service";
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CoffeeController, HealthController],
  providers: [CoffeeService],
})
export class AppModule {}
