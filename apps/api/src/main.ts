import { PrismaErrorFilter } from "./prisma/prisma.filter";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import cookieParser = require("cookie-parser");
import helmet from "helmet";
import { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
    throw Error("JWT_SECRET of 32+ characters required");
  if (!process.env.APP_ORIGIN) throw Error("APP_ORIGIN required");
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (req.headers.origin !== process.env.APP_ORIGIN ||
        req.headers["x-estylo-request"] !== "1")
    )
      return res.status(403).json({ message: "Untrusted request origin" });
    next();
  });
  app.useGlobalFilters(new PrismaErrorFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Estylo Coffee API")
      .setVersion("2.0")
      .addCookieAuth("estylo_token")
      .build(),
  );
  SwaggerModule.setup("api/docs", app, doc);
  await app.listen(Number(process.env.PORT || 3000), "0.0.0.0");
}
bootstrap();
