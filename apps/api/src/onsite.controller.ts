
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Injectable,
  Post,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";

import { Type } from "class-transformer";

import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

import type { Request } from "express";

import { PrismaService } from "./prisma/prisma.service";
import { CoffeeService } from "./coffee.service";
import { OrderDto } from "./coffee.dto";

// =====================================================
// DTO: Guest Order Add-ons
// =====================================================

class GuestAddonDto {
  @IsUUID()
  addonId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

// =====================================================
// DTO: Guest Order Item
// =====================================================

class GuestItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => GuestAddonDto)
  addons!: GuestAddonDto[];
}

// =====================================================
// DTO: Guest Order
// =====================================================

class GuestOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  customer!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => GuestItemDto)
  items!: GuestItemDto[];
}

// =====================================================
// CONTROLLER: Public Onsite Ordering
// =====================================================

@Injectable()
@Controller("onsite")
export class OnsiteController {
  // ---------------------------------------------------
  // Basic rate limiting
  //
  // Maximum: 10 order attempts per IP
  // Window: 10 minutes
  //
  // For production deployments with multiple API
  // instances, use a shared Redis-backed rate limiter.
  // ---------------------------------------------------

  private readonly attempts = new Map<
    string,
    {
      count: number;
      resetAt: number;
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly coffee: CoffeeService
  ) {}

  // ===================================================
  // GET /api/onsite/menu
  //
  // Public endpoint
  // No login required
  //
  // Returns active coffee products and add-ons.
  // ===================================================

  @Get("menu")
  async menu() {
    const [products, addons] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          active: true,
          priceCentavos: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          priceCentavos: true,
          active: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      this.prisma.addon.findMany({
        where: {
          active: true,
        },
        select: {
          id: true,
          name: true,
          priceCentavos: true,
          active: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    return {
      products: products.filter(
        (product) => (product.priceCentavos ?? 0) > 0
      ),
      addons,
    };
  }

  // ===================================================
  // POST /api/onsite/orders
  //
  // Public endpoint
  // No login required
  //
  // Creates an unpaid onsite order.
  // ===================================================

  @Post("orders")
  async create(
    @Body() guest: GuestOrderDto,
    @Headers("idempotency-key") key: string,
    @Req() request: Request
  ) {
    // -------------------------------------------------
    // 1. Validate idempotency key
    // -------------------------------------------------

    if (!key || key.length < 16 || key.length > 80) {
      throw new BadRequestException(
        "Valid Idempotency-Key required"
      );
    }

    // -------------------------------------------------
    // 2. Validate customer name
    // -------------------------------------------------

    if (!guest.customer?.trim()) {
      throw new BadRequestException(
        "Customer name is required"
      );
    }

    // -------------------------------------------------
    // 3. Validate number of cups
    // -------------------------------------------------

    const cupCount = guest.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );

    if (cupCount > 50) {
      throw new BadRequestException(
        "Maximum 50 cups per order"
      );
    }

    // -------------------------------------------------
    // 4. Rate limiting
    //
    // Maximum 10 attempts every 10 minutes per IP.
    //
    // FIX:
    // Use HttpException with status 429 instead of
    // TooManyRequestsException.
    // -------------------------------------------------

    const ip = request.ip || "unknown";

    const now = Date.now();

    const periodMs = 10 * 60 * 1000;

    const current = this.attempts.get(ip);

    // Clean expired entries to control memory usage.

    if (this.attempts.size > 10000) {
      for (const [address, record] of this.attempts) {
        if (record.resetAt <= now) {
          this.attempts.delete(address);
        }
      }
    }

    if (!current || current.resetAt <= now) {
      this.attempts.set(ip, {
        count: 1,
        resetAt: now + periodMs,
      });
    } else {
      if (current.count >= 10) {
        // FIXED: HTTP 429 Too Many Requests

        throw new HttpException(
          "Too many orders. Please ask the cashier for help.",
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      current.count++;
    }

    // -------------------------------------------------
    // 5. Get configured onsite ordering account
    //
    // Every order needs a staff account attribution.
    // Guests do not receive access to this account.
    // -------------------------------------------------

    const actorId = process.env.ONSITE_ACTOR_USER_ID;

    if (!actorId) {
      throw new ServiceUnavailableException(
        "Onsite ordering is not configured"
      );
    }

    
    const actor = await this.prisma.user.findUnique({
    where: {
        id: actorId,
    },
    select: {
        id: true,
        active: true,
        role: true,
    },
    });

    if (
    !actor ||
    !actor.active ||
    actor.role !== "GUEST"
    ) {
    throw new ServiceUnavailableException(
        "Onsite ordering requires an active GUEST account"
    );
    }


    if (!actor?.active) {
      throw new ServiceUnavailableException(
        "Onsite ordering account is unavailable"
      );
    }

    // -------------------------------------------------
    // 6. Build order DTO
    //
    // Guest orders are always:
    //
    // Fulfillment: PICKUP
    // Source: WALK_IN
    // Payment: UNPAID
    //
    // No phone number or delivery address required.
    // -------------------------------------------------

    const dto: OrderDto = {
      customer: guest.customer.trim(),

      phone: "",

      address: "",

      fulfillment: "PICKUP",

      source: "WALK_IN",

      items: guest.items.map((item) => ({
        productId: item.productId,

        quantity: item.quantity,

        addons: item.addons,
      })),
    };

    // -------------------------------------------------
    // 7. Create the order
    //
    // Uses existing CoffeeService:
    //
    // - Validates products
    // - Validates add-ons
    // - Calculates prices on the server
    // - Creates order and order items
    // - Supports idempotency
    // - Records audit information
    // -------------------------------------------------

    const order = await this.coffee.create(
      dto,
      key,
      actor.id
    );

    // -------------------------------------------------
    // 8. Return guest-safe receipt
    //
    // No internal staff information is exposed.
    // -------------------------------------------------

    return {
      id: order.id,

      customer: order.customer,

      totalCentavos: order.totalCentavos,

      status: order.status,

      payment: order.payment,

      items: order.items.map((item) => ({
        name: item.name,

        quantity: item.quantity,

        unitPriceCentavos: item.unitPriceCentavos,

        addons: item.addons.map((addon) => ({
          name: addon.name,

          quantity: addon.quantity,

          unitPriceCentavos: addon.unitPriceCentavos,
        })),
      })),
    };
  }
}
