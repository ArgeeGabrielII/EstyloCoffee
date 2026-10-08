export type Role = "ADMIN" | "CASHIER";

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function api<T>(path: string, init: RequestInit = {}) {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      "X-Estylo-Request": "1",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    let body: any = null;

    try {
      body = await res.json();
    } catch {
      // Response may not contain JSON.
    }

    let message = body?.message ?? `Request failed (${res.status})`;

    if (Array.isArray(message)) {
      message = message.join(", ");
    }

    throw new ApiError(res.status, String(message), body);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const money = (value: string | number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(value) / 100);
