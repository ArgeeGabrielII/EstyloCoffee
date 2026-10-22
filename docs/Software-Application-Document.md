# Software Application Document

## Estylo Coffee Tracker | Version 2.1 | 22 October 2026

### 1. Purpose and scope

Estylo Coffee Tracker is a browser-based point-of-sale and order-management application for café staff. It supports walk-in and manually received SMS pickup/delivery orders, preparation tracking, manually confirmed payments, product/add-on maintenance, reporting, and a public queue display. The application is operated **without Docker**. This document reflects the current requested workflow and source updates; deployment-specific details should be verified on the target host.

### 2. Technology and architecture

| Tier | Technology | Responsibility |
| --- | --- | --- |
| Web | React 19, Vite 6, TypeScript, Bootstrap 5 | Cashier, orders, dashboard, maintenance, public pages |
| API | NestJS 11, TypeScript, Prisma 6, JWT, Argon2 | Validation, authentication, transactions, business rules |
| Database | PostgreSQL (locally installed or independently hosted) | Durable users, catalog, orders, payments, audit logs |

Development flow: browser at `http://localhost:5174` → Vite proxy `/api` → NestJS at `http://localhost:3001` → PostgreSQL at the host in `DATABASE_URL` (commonly `localhost:5432`). These ports match the checked-in `apps/web/vite.config.ts`; confirm API `PORT=3001` in the root `.env`. No containers, Compose service names, Docker volumes, or container-specific hostnames are required.

For production, compile the API and web assets and run them under a host process manager, with an HTTPS reverse proxy for the browser and `/api`. Reverse proxy configuration, domain, certificate, and process manager are deployment-specific and are not supplied here. Keep PostgreSQL access restricted.

### 3. Repository layout

- `apps/api`: NestJS API, Prisma schema, migrations, seed.
- `apps/web`: React/Vite user interface.
- `docs`: application documentation and browser test artifacts.
- `scripts`: native PostgreSQL backup and restore helpers.
- `.env`: root environment configuration, never committed.
- `makefile`: local development and maintenance commands without Docker.

### 4. Access and roles

`ADMIN` and `CASHIER` users can create orders, use the cashier workspace, view the order board, confirm payment, and update preparation status. Admin-only features include dashboard, reports, product/add-on maintenance, payment-method maintenance, user maintenance, and audit log. Public pages `/onsite` and `/queue` can be opened separately; confirm their intended public exposure before internet deployment. Backend guards, not only hidden navigation links, enforce permissions.

### 5. Ordering and fulfillment

Staff enter walk-in or SMS orders, select pickup or delivery, and record customer details. SMS is a source label: messages are entered manually; the application does not integrate with an SMS provider. The cashier can open the Orders page. The sidebar provides links to `/onsite` and `/queue` in separate tabs. Queue numbers identify orders. Orders are displayed under New Orders, Preparing, Ready for PickUp, Completed, and Cancelled.

An unpaid order card has an `UNPAID` watermark. Tapping an order opens a detail modal with queue number emphasized over the customer name, order lines, totals, and actions. Tapping outside the modal closes it when no transaction is in progress. Order actions use touch-friendly controls for tablet operation.

### 6. Payments

Payment is **manually recorded**, not processed by a payment gateway. Confirm Payment opens a confirmation dialog with large tappable cards populated from active Payment Methods maintenance records. Typical methods are Cash, Bank Transfer, and GCash. The chosen method is stored with the order along with its payment state; paid orders no longer show the UNPAID watermark. Payment methods can be maintained by administrators. This does not verify bank transfers or issue refunds.

### 7. Order state and cancellation rules

| Current state | Next state / action |
| --- | --- |
| NEW | Start Preparing; Cancel Order (unpaid) or Void Transaction (paid), with confirmation |
| PREPARING | Ready for PickUp; cancellation/void not permitted |
| READY | Complete Order; cancellation/void not permitted |
| COMPLETED | Terminal |
| CANCELLED | Terminal |

Cancellation or void is allowed **only while status is NEW**, and always requires explicit confirmation. The UI shows one action: `Cancel Order` for unpaid orders, or `Void Transaction` for paid orders. A paid void does **not** automatically refund the customer. Completion requires confirmed payment. Backend transition rules must enforce the same restrictions as the UI.

### 8. Data model

- `User`: identity, role, active flag, Argon2 password hash.
- `Product`: drink name, price, active flag.
- `Addon`: extra name, price, active flag.
- `Order`: queue identifiers, customer, source, fulfillment, state, payment status, selected payment method snapshot, total, timestamps, creator.
- `OrderItem`: drink quantity, name/price snapshots, free-drink flag.
- `OrderItemAddon`: add-on quantity and price snapshot.
- `PaymentMethod`: unique name, active flag, linked orders.
- `AuditLog`: actor, event, entity, timestamp.

Prisma migrations reside in `apps/api/prisma/migrations`. Monetary amounts are stored in centavos. Existing database records are preserved by applying migrations rather than resetting the database.

### 9. Reports and marketing indicators

The admin dashboard shows operational totals plus **Sales Growth** and **Peak Sales Hour**. Sales Growth compares today's paid, non-cancelled order revenue to the same elapsed period yesterday, in Philippine time; if yesterday's baseline is zero, show `No baseline`. Peak Sales Hour identifies the one-hour interval with the highest count of paid, non-cancelled orders created today, using Asia/Manila time. The marketing dashboard endpoint is `/api/reports/marketing-dashboard` where installed. Metrics use order creation time, not the payment-received timestamp. Reports provide drink and add-on sales breakdowns; free drinks contribute zero base drink revenue but their paid add-ons contribute revenue.

### 10. Authentication and security

The API uses an HttpOnly session cookie, active-user checks, role guards, DTO validation, and an allowed origin configured through `APP_ORIGIN`. Browser mutations include `X-Estylo-Request: 1`. Set `COOKIE_SECURE=true` when HTTPS is enabled. Never commit `.env`, expose PostgreSQL publicly, use demo secrets in production, or expose Vite development mode to the public internet. Restrict file permissions for backups and use a dedicated database account.

### 11. Local installation (no Docker)

Requirements: Node.js 22, npm, a running PostgreSQL server, and a created PostgreSQL database/user with appropriate privileges.

1. At the repository root, run `npm ci`.
2. Copy `.env.example` to `.env`, then set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `APP_ORIGIN=http://localhost:5174`, `PORT=3001`, and `COOKIE_SECURE=false` for local HTTP use.
3. Load root variables in the terminal: `set -a; . ./.env; set +a` (POSIX shell; quote values containing special characters appropriately).
4. Run `npm run db:generate`, `npm run db:deploy`, and `npm run db:seed` from the project root. Run seed only after confirming the target database and intended initial administrator.
5. Start the API with `npm run dev:api`; in a second terminal start the frontend with `npm run dev:web`.
6. Open `http://localhost:5174`.

The root `.env` is **not automatically read** by Prisma when invoking it from `apps/api`. Either export root variables before Prisma commands or use a suitable environment loader. When running in separate terminal windows, export root variables in each shell that needs them. `DATABASE_URL` must point to the native PostgreSQL service, not a Compose hostname like `db`.

### 12. Production deployment (no Docker)

1. Provision PostgreSQL separately and back it up before schema changes.
2. Install Node.js/npm and run `npm ci` on the deployment host or build in CI for the target architecture.
3. Load production environment variables securely, with `APP_ORIGIN` set to the actual HTTPS browser origin, `COOKIE_SECURE=true`, and a strong JWT secret.
4. Apply versioned migrations with `npm run db:deploy`, then run `npm run db:generate` and `npm run build`.
5. Run NestJS as a managed host process (`npm -w apps/api run start`) and serve `apps/web/dist` with a properly configured HTTPS web server; proxy `/api` to the API port.
6. Ensure the web server supports SPA history fallback to `index.html`, restrict access to the API/database, and test login, order creation, payment, reporting, and queue updates.

Do not use the development Vite server as a production server. No production reverse-proxy or service-manager configuration is assumed to exist.

### 13. Backup, restore, and monitoring

`scripts/backup-db.sh` runs native `pg_dump` using the root `.env` connection string and saves a timestamped SQL file under `backups/`. `scripts/restore-db.sh` runs native `psql` against `DATABASE_URL`, requires explicit `CONFIRM_RESTORE=YES`, and should only be used against a deliberately selected **empty recovery database**. Verify the target URL before restore. Keep encrypted copies off-host and practice recovery. Monitor the API process, database, disk, and backups through host tooling.

### 14. Testing and acceptance

Run `npm run build`, `npm run lint`, and `npm test`. For browser layout tests run `npm run test:responsive` after installing the required Playwright browser. Validate real iPad Safari behavior, LAN origin settings, authentication, payment methods, NEW-only cancellation, migrations, and backup/restore against a nonproduction database. Current local installation and deployment were not executed as part of this documentation update.

### 15. Out of scope

Automatic SMS ingestion, actual payment collection/verification, automated refunds, inventory/recipes, tax and discount accounting, offline POS, managed production hosting, scheduled backups, and cloud deployment are not provided by this document.
