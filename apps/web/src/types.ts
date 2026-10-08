export type Addon = {
  id: string;
  name: string;
  priceCentavos: number;
  active: boolean;
};

export type Product = {
  id: string;
  name: string;
  priceCentavos: number | null;
  active: boolean;
};

export type Status =
  | "NEW"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type Order = {
  id: string;
  customer: string;
  phone: string;
  address: string;
  fulfillment: string;
  source: string;
  status: Status;
  payment: "PAID" | "UNPAID";
  totalCentavos: number;
  createdAt: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    unitPriceCentavos: number;
    addons?: {
      id: string;
      name: string;
      quantity: number;
      unitPriceCentavos: number;
    }[];
  }[];
};

export type Report = {
  count: number;
  paidCount: number;
  paidCentavos: number;
  open: number;
  statuses: { status: Status; _count: number }[];
};