import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaErrorFilter implements ExceptionFilter {
  catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      error.code === "P2025" ? 404 : error.code === "P2002" ? 409 : 500;
    response
      .status(status)
      .json({
        statusCode: status,
        message:
          status === 404
            ? "Record not found"
            : status === 409
              ? "Record already exists"
              : "Database operation failed",
      });
  }
}
