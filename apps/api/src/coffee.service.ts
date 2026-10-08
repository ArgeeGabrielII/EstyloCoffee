import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service";
import { OrderDto, UpdateOrderDto } from "./coffee.dto";
import { transition } from "./order-rules";

@Injectable()
export class CoffeeService {
  constructor(private p: PrismaService) {}

  async create(dto: OrderDto, key: string, actor: string) {
    if (!key || key.length < 16 || key.length > 80) {
      throw new BadRequestException(
        "Idempotency-Key required (16–80 characters)",
      );
    }

    if (
      !dto.customer.trim() ||
      (dto.fulfillment === "DELIVERY" &&
        (!dto.address.trim() || !dto.phone.trim())) ||
      (dto.source === "SMS" && !dto.phone.trim())
    ) {
      throw new BadRequestException("Customer, phone/address required");
    }

    return this.p.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${key}))
      `;

      const old = await tx.order.findUnique({
        where: { requestKey: key },
        include: { items: { include: { addons: true } } },
      });

      if (old) return old;

      const items = [];
      let totalCentavos = 0;

      for (const line of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: line.productId },
        });

        if (!product?.active || !product.priceCentavos) {
          throw new BadRequestException(
            "Product unavailable or price not configured",
          );
        }

        const addons = [];
        let addonTotal = 0;
        const seen = new Set<string>();

        for (const selection of line.addons || []) {
          if (seen.has(selection.addonId)) {
            throw new BadRequestException("Duplicate add-on selection");
          }

          seen.add(selection.addonId);

          const addon = await tx.addon.findUnique({
            where: { id: selection.addonId },
          });

          if (!addon?.active) {
            throw new BadRequestException("Add-on unavailable");
          }

          addonTotal += addon.priceCentavos * selection.quantity;

          addons.push({
            addonId: addon.id,
            name: addon.name,
            quantity: selection.quantity,
            unitPriceCentavos: addon.priceCentavos,
          });
        }

        totalCentavos +=
          (product.priceCentavos + addonTotal) * line.quantity;

        items.push({
          productId: product.id,
          name: product.name,
          quantity: line.quantity,
          unitPriceCentavos: product.priceCentavos,
          addons: { create: addons },
        });
      }

      if (totalCentavos > 2000000000) {
        throw new BadRequestException(
          "Order exceeds maximum supported total",
        );
      }

      const order = await tx.order.create({
        data: {
          requestKey: key,
          customer: dto.customer.trim(),
          phone: dto.phone,
          address: dto.address,
          fulfillment: dto.fulfillment,
          source: dto.source,
          totalCentavos,
          createdBy: actor,
          items: { create: items },
        },
        include: { items: { include: { addons: true } } },
      });

      await tx.auditLog.create({
        data: {
          event: "ORDER_CREATED",
          entityId: order.id,
          userId: actor,
        },
      });

      return order;
    });
  }

  async update(id: string, dto: UpdateOrderDto, actor: string) {
    return this.p.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Order" WHERE id=${id} FOR UPDATE
      `;

      const old = await tx.order.findUnique({ where: { id } });

      if (!old) throw new NotFoundException();

      const next = transition(old, dto);
      const order = await tx.order.update({ where: { id }, data: next });

      await tx.auditLog.create({
        data: {
          event: "ORDER_" + next.status + "_" + next.payment,
          entityId: id,
          userId: actor,
        },
      });

      return order;
    });
  }
}