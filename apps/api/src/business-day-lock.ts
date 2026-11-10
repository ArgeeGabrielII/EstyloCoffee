import { ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { businessDateValue, businessDayFor, DEFAULT_HOURS } from "./store-hours.service";

type Database = Prisma.TransactionClient;

// Every financial mutation and manual close takes the same PostgreSQL
// transaction-scoped lock. A failed transaction releases the lock automatically.
export async function lockBusinessDay(tx: Database, day: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"estylo-business-day:" + day}))`;
}

export async function assertFinancialDayOpen(
  tx: Database,
  day: string,
  now?: Date,
): Promise<void> {
  await lockBusinessDay(tx, day);
  const closed = await tx.businessDayClose.findUnique({
    where: { businessDate: businessDateValue(day) },
  });
  if (closed) {
    throw new ConflictException("This business day has been finalized. Financial changes are locked.");
  }
  const settings = (await tx.storeHours.findUnique({ where: { id: 1 } })) ?? DEFAULT_HOURS;
  if (businessDayFor(now ?? new Date(), settings) !== day) {
    throw new ConflictException("This business day has passed the reconciliation cutoff. Financial changes are locked.");
  }
}
