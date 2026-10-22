# Estylo Coffee — Free Drink (base drink only)

Replace these project files with the matching files in this archive:

- apps/api/prisma/schema.prisma
- apps/api/prisma/migrations/20261022090000_free_drink/migration.sql
- apps/api/src/coffee.dto.ts
- apps/api/src/coffee.service.ts
- apps/web/src/types.ts
- apps/web/src/pages/CashierPage.tsx
- apps/web/src/pages/OrdersPage.tsx

Important: The schema here matches the reviewed GitHub revision (queueDate and queueNumber already present). If your LOCAL schema has additional changes, merge the `freeDrink Boolean @default(false)` field into OrderItem rather than overwriting local changes.

The migration adds a non-nullable Boolean with a default of false, so old orders are treated as regular-priced drinks.

After backing up your DB, run from the repository root:

    npx prisma validate --schema=apps/api/prisma/schema.prisma
    npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
    npx prisma generate --schema=apps/api/prisma/schema.prisma

Restart the API and frontend.

For local development only, if there are no existing pending migrations other than this one, `migrate deploy` applies it. Check `npx prisma migrate status --schema=apps/api/prisma/schema.prisma` first.

Test a 150 peso drink with a 30 peso addon marked Free Drink. Total should be 30 pesos. Verify barista board displays FREE DRINK and add-on 30 pesos. Test a normal cup and an existing order.

Security note: The backend currently accepts `freeDrink` from any authenticated role allowed to POST /orders. If complimentary discounts should be restricted to ADMIN users, add authorization before enabling this in production.
