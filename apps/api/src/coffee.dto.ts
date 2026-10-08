import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import {
  Fulfillment,
  OrderSource,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "@prisma/client";

export class ProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000000)
  priceCentavos?: number | null;

  @IsBoolean()
  active!: boolean;
}

export class AddonSelectionDto {
  @IsUUID()
  addonId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class AddonDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  priceCentavos!: number;

  @IsBoolean()
  active!: boolean;
}

export class ItemDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AddonSelectionDto)
  addons?: AddonSelectionDto[];

  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;
}

export class OrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  customer!: string;

  @IsString()
  @MaxLength(30)
  phone!: string;

  @IsString()
  @MaxLength(300)
  address!: string;

  @IsEnum(Fulfillment)
  fulfillment!: Fulfillment;

  @IsEnum(OrderSource)
  source!: OrderSource;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  payment?: PaymentStatus;
}

export class UserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(200)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}

export class ActiveDto {
  @IsBoolean()
  active!: boolean;
}