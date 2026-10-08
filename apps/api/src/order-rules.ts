import { BadRequestException, ConflictException } from "@nestjs/common";
import { OrderStatus, PaymentStatus } from "@prisma/client";
export function transition(
  old: { status: OrderStatus; payment: PaymentStatus },
  next: { status?: OrderStatus; payment?: PaymentStatus },
) {
  const allowed: Record<OrderStatus, OrderStatus[]> = {
    NEW: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["COMPLETED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  const status = next.status || old.status,
    payment = next.payment || old.payment;
  if (status !== old.status && !allowed[old.status].includes(status))
    throw new ConflictException("Invalid status transition");
  if (old.payment === "PAID" && payment !== "PAID")
    throw new BadRequestException(
      "Paid cannot be reversed; use a refund process",
    );
  if (status === "CANCELLED" && payment === "PAID")
    throw new ConflictException("Paid orders cannot be cancelled");
  if (status === "COMPLETED" && payment !== "PAID")
    throw new ConflictException("Payment required before completion");
  return { status, payment };
}
