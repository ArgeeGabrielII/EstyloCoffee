# Estylo Coffee Tracker

Estylo Coffee is a React/Vite frontend, NestJS/Prisma API, and PostgreSQL database for café ordering and operations. **Docker is not used.** PostgreSQL runs as a native service or on an independently hosted database; Node.js and npm run the application directly.

## Requirements

- Node.js 22 and npm
- PostgreSQL server and credentials (installed locally or hosted separately)
- A database and user with privileges appropriate for migrations
- Git; `pg_dump` and `psql` for backup/restore

## Quick start — local development

From the project root:

```bash
npm ci
cp .env.example .env
```

Edit the root `.env` and set a valid `DATABASE_URL`, strong `JWT_SECRET`, `ADMIN_PASSWORD`, and `APP_ORIGIN=http://localhost:5174`. The Vite configuration currently proxies `/api` to `http://localhost:3001`, so use `PORT=3001` for the API unless you also update `apps/web/vite.config.ts`.

In the project root, load the environment and prepare Prisma:

```bash
set -a
. ./.env
set +a
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev:api
```

In a **second terminal**, from the root:

```bash
npm run dev:web
```

Open `http://localhost:5174` in your browser. Use the Admin credentials configured in `.env`. For local iPad testing, set `APP_ORIGIN` to the actual LAN URL and open that exact URL; use the host's LAN IP and configure Vite/API ports/firewall appropriately.

**Root `.env` caveat:** Prisma running inside `apps/api` does not automatically find a `.env` stored at the repository root. Export the root variables before Prisma commands. Never commit `.env`.

## Production deployment

Run migrations, generate Prisma client, and build:

```bash
set -a; . ./.env; set +a
npm run db:deploy
npm run db:generate
npm run build
```

Run the built API as a managed host process with `npm -w apps/api run start`. Serve `apps/web/dist` from an HTTPS-capable web server with SPA fallback and reverse-proxy `/api` to the API. Set `APP_ORIGIN` to the exact HTTPS origin and `COOKIE_SECURE=true`. These production hosting components are configured separately; no container configuration is required.

## Operations

- `/cashier`: touch-friendly POS and order creation; links to Orders.
- `/orders`: order detail popup, unpaid watermark, payment confirmation cards, preparation workflow, and NEW-only cancel/void with confirmation.
- `/dashboard`: daily operational KPIs, Sales Growth, Peak Sales Hour (when latest dashboard upgrade is installed).
- `/reports`: sales and drink/add-on breakdowns.
- `/maintenance/products`: drinks and add-ons.
- `/maintenance/payment-methods`: admin-managed Cash/Bank Transfer/GCash and other payment methods.
- `/maintenance/users`, `/maintenance/audit`: account maintenance and audit log.
- `/onsite`, `/queue`: public ordering and queue display pages.

SMS orders are entered manually; the app does not send SMS. Payment confirmation is manual, not a payment gateway.

## Validation

```bash
npm run build
npm run lint
npm test
npm run test:responsive
```

The responsive test requires Playwright Chromium (`npx playwright install chromium`). Integration tests require a separate test PostgreSQL database; never run destructive tests on live data.

## Backup and recovery (native PostgreSQL)

```bash
bash scripts/backup-db.sh
# For a deliberate restore to an EMPTY recovery database only:
CONFIRM_RESTORE=YES bash scripts/restore-db.sh backups/your-backup.sql
```

Both scripts use the `DATABASE_URL` in the root `.env` and require `pg_dump`/`psql` installed on the host. Verify the database target before running restore. Backups are local files; copy them securely off-host.

## Files

- `apps/api`: NestJS backend and Prisma migrations
- `apps/web`: React/Vite frontend
- `docs/Software-Application-Document.md`: detailed architecture, features, and operations
- `scripts/backup-db.sh`, `scripts/restore-db.sh`: native database utilities
- `makefile`: optional convenience commands

For existing databases, use migrations and backups; **do not run `prisma migrate reset`**.
