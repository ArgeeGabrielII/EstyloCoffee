import { BadRequestException, ConflictException } from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";

export function transition(
  old: { status: OrderStatus; payment: PaymentStatus },
  next: { status?: OrderStatus; payment?: PaymentStatus },
) {
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    NEW: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY"],
    READY: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  const status = next.status || old.status;
  const payment = next.payment || old.payment;
  if (status !== old.status && !allowed[old.status].includes(status)) {
    throw new ConflictException("Invalid status transition. Cancellation is only allowed in New Orders");
  }
  if (old.payment === "PAID" && payment !== "PAID") {
    throw new BadRequestException("Paid cannot be reversed; use a refund process");
  }
  if (status === "CANCELLED" && payment === "PAID") {
    throw new ConflictException("Paid orders cannot be cancelled; use the void transaction action in New Orders");
  }
  if (status === "COMPLETED" && payment !== "PAID") {
    throw new ConflictException("Payment required before completion");
  }
  return { status, payment };
}
