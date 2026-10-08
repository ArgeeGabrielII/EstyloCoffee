# Estylo Coffee Tracker

Rebuilt to follow the supplied **estylo-barbers-tracker**: npm workspaces, NestJS API, Prisma/PostgreSQL, React/Vite/Bootstrap, black-and-gold management sidebar, and a separate touch-friendly cashier workspace. The supplied coffee logo and all 11 drink names are included. Only ADMIN and CASHIER roles are supported.

## Start with Docker Compose

1. Copy `.env.example` to `.env`.
2. Replace POSTGRES_PASSWORD with a strong **alphanumeric** password. Set JWT_SECRET to a random 32+ character secret and ADMIN_PASSWORD to a strong 12+ character password. No fixed default login is provided.
3. Set APP_ORIGIN to the **exact browser origin**: for local use `http://localhost:8080`; for a trusted LAN `http://<server-IP>:8080`; for production `https://coffee.example.com`. One origin is allowed. Set COOKIE_SECURE=true when using HTTPS.
4. Run `docker compose up -d --build`. The API deploys Prisma migrations and seeds the menu/initial Admin before serving. Existing prices/users are not overwritten.
5. Open APP_ORIGIN in your browser. Sign in with ADMIN_USERNAME/ADMIN_PASSWORD from `.env`.
6. Open **Drinks** and set real prices in pesos. Unpriced drinks cannot be sold. Open **Users** to create Cashier accounts.
7. Use **Cashier** to create walk-in/SMS pickup/delivery orders, and **Orders** to record payment and preparation. Admin can view **Dashboard**, **Reports**, and **Audit Log**.

Compose publishes only frontend port 8080. The API and DB stay inside the Docker network. A new database volume named for this project is used. **This is a fresh NestJS/Prisma application; the previous Flask/SQLite/PostgreSQL tables are not automatically imported.** Back up existing data before adopting this version.

## Local development

Use Node.js 22, npm, and PostgreSQL 17. From the project root:

```bash
npm ci
npm run db:generate
```

Export variables from `.env` into your shell (copying the file alone does not export them). For local API development DATABASE_URL uses your PostgreSQL hostname, and APP_ORIGIN should be `http://localhost:5173` (Vite's origin). If you change ports, update APP_ORIGIN too.

```bash
npm run db:deploy
npm run db:seed
npm run dev:api
# In another shell:
npm run dev:web
```

Vite proxies `/api` to localhost:3000. Browser requests need the expected Origin and `X-Estylo-Request: 1`; the frontend sends both. Do not expose the development server publicly.

## Validation

```bash
npm run build
npm run lint
npm test
```

`lint` runs TypeScript checks in both workspaces. API tests exercise role/active-user guards, DTO validation, price snapshots, idempotent order retries and payment/preparation rules. Database calls in service tests are mocked. The included GitHub Actions workflow also runs `tests/integration.cjs` against a disposable PostgreSQL database; that suite requires INTEGRATION_TEST_DATABASE=true and seeded credentials. PostgreSQL/Compose acceptance testing is still required.

## Project structure

- `apps/api/src/auth`, `common`, `prisma`: reference-pattern authentication and authorization.
- `apps/api/src/coffee.*`, `order-rules.ts`: coffee-specific endpoints and ordering rules.
- `apps/api/prisma`: schema, initial migration with constraints, repeatable seed.
- `apps/web/src/auth`, `components`, `pages`: authentication, admin shell, cashier and management pages.
- `scripts`: database backup/restore helpers.
- `docs/Software-Application-Document.md`: requirements, architecture, roles, data, API, security, operations, validation, and scope.

SMS orders are manually entered by staff; no SMS gateway or automated replies are configured. Payments are manually confirmed, not electronically processed. No inventory/recipe system or barber-specific modules are carried over. See the application document for the full implementation scope.

## Responsive browser checks

After building, run `npx playwright install chromium` then `npm run test:responsive`. This suite serves the compiled frontend through browser request interception with mock API fixtures and checks six phone/tablet resolutions. It does not contact PostgreSQL. The included `docs/browser-results.json` records the checks completed during this rebuild. Test fixture prices are not seeded application prices.
