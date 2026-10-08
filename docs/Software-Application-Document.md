# Software Application Document

## Estylo Coffee Tracker · Version 2.0 · 7 October 2026

### 1. Purpose and source requirements

Rebuild the coffee ordering application using the supplied `estylo-barbers-tracker.zip` as the implementation and presentation reference. Retain three independent tiers, the supplied Estylo Coffee logo, Cashier/Admin access, all 11 listed drinks, and staff entry of SMS pickup/delivery orders.

The reference establishes a TypeScript npm-workspace repository, NestJS, Prisma/PostgreSQL, React/Vite, Bootstrap, a black-and-gold sidebar management interface, and a separate cashier interface. Those patterns are reused. Coffee modules replace barber/seat/service checkout modules. The reference's VIEWER role, fixed demo credentials, barber inventory recipes, tips and commission logic are not carried over because they are outside the coffee requirements.

Authoritative inputs: Coffee-Menu.txt, Order-System.txt, image(1).png and estylo-barbers-tracker.zip. Prices, sizes, temperatures, recipes, delivery charges, discounts and tax rules were not supplied. No commercial values are invented; Admin must configure drink prices before orders can be created.

### 2. Architecture

| Tier     | Components                                                    | Responsibility                                                                                        |
| -------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend | React 19, Vite 6, TypeScript, Bootstrap 5, nginx              | Role-aware routing, admin shell, cashier POS, order board and maintenance                             |
| API      | NestJS 11, TypeScript, class-validator, JWT, Argon2, Prisma 6 | Session authentication, role guards, input validation, authoritative totals and business transactions |
| Database | PostgreSQL 17                                                 | Persistent users, drink catalog, orders, immutable price snapshots and audit log                      |

Request flow: Browser → nginx (host port 8080) → NestJS (internal port 3000) → PostgreSQL (internal port 5432). Production exposes only the frontend behind HTTPS. Vite proxies /api to the API during development. PostgreSQL and API are separate Compose services; source is split into `apps/api` and `apps/web` workspaces, following the reference.

### 3. Mapping to the barber tracker

| Reference feature                         | Coffee adaptation                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Sidebar dashboard / reports / maintenance | Dashboard, reports, drinks, users, audit                                           |
| Separate cashier screen                   | Touch-friendly coffee selection/cart and customer/fulfillment form                 |
| Services and checkouts                    | Product catalog and pickup/delivery order orchestration                            |
| Transaction snapshot prices               | Order item name/price snapshots                                                    |
| JWT cookie + database active check        | Preserved, with strict cookies and trusted-origin mutation checks                  |
| Prisma schema and seeds                   | Coffee-specific schema, checked migration and safe environment-based initial Admin |
| Black / gold design                       | Preserved, with coffee logo and mobile navigation                                  |
| Backup / restore scripts                  | Coffee database helpers                                                            |

### 4. Functional scope

Staff sign in, select available priced drinks, adjust quantities, record customer and phone, select pickup/delivery and walk-in/SMS, and create an order. Delivery requires phone and address; SMS requires phone. Order board supports manual Paid marking, preparation transitions and unpaid cancellation. Admin sets prices/availability, creates accounts, enables/disables other accounts, views reports and reads audit history.

Order source SMS means a staff member received an SMS and entered it. There is no inbound webhook, external SMS provider, automated notification or customer self-service ordering. Mark paid records staff verification of an external payment; it does not charge a payment instrument or verify a bank/GCash transaction.

### 5. Role matrix

| Capability                                      | CASHIER | ADMIN |
| ----------------------------------------------- | ------- | ----- |
| Sign in / cashier / order board                 | Yes     | Yes   |
| Create orders / mark paid / change preparation  | Yes     | Yes   |
| Cancel unpaid New/Preparing orders              | Yes     | Yes   |
| View dashboard and date-range reports           | No      | Yes   |
| Configure drink prices and availability         | No      | Yes   |
| Create users / enable or disable other accounts | No      | Yes   |
| Read audit log                                  | No      | Yes   |

The database role and active flag are read on each protected request, rather than relying on JWT role claims alone. Cashier cannot call Admin endpoints directly. Disabling an account blocks its next API request even if it still possesses an unexpired cookie. Admin cannot disable their own account. Role changes/password reset are not implemented; provision another account as needed.

### 6. Data model

| Entity    | Key fields / constraints                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| User      | UUID, unique username, displayName, Argon2 passwordHash, ADMIN/CASHIER, active, createdAt                                     |
| Product   | UUID, unique name, nullable positive priceCentavos, active                                                                    |
| Order     | UUID, unique requestKey, customer, phone/address, fulfillment/source enums, status/payment, totalCentavos, creator, createdAt |
| OrderItem | UUID, order/product foreign keys, name snapshot, quantity 1–99, unitPriceCentavos snapshot                                    |
| AuditLog  | UUID, actor foreign key, event, entityId, createdAt                                                                           |

One user creates many orders and audit events. Orders contain many item snapshots; products may appear in many historical orders. Price changes do not rewrite order history. UUIDs are generated by Prisma. Creation timestamps are UTC. Database constraints reject negative/zero prices and invalid quantities/totals. Prisma migrations are versioned under `apps/api/prisma/migrations`.

Money is integer centavos in storage/API, converted to PHP display in the frontend. Product prices are restricted to 1–1,000,000 centavos. Orders are limited to 50 submitted lines, quantities 1–99, and total 2,000,000,000 centavos. Client-supplied totals/unknown DTO fields are rejected.

### 7. Transaction and workflow rules

Create order executes inside a Prisma transaction. A PostgreSQL advisory transaction lock on the request key serializes duplicate retries, then the API reads the menu, verifies availability/prices, calculates totals, creates the order and snapshot items, and writes the audit event. All writes commit or roll back together. Same-key retries return the original order; do not reuse keys for a new order or changed payload.

Updates lock the order row with FOR UPDATE before checking workflow/payment, then update and audit in the same transaction. Product and user mutations likewise write audit records in the same transaction.

| Current status | Allowed next status  |
| -------------- | -------------------- |
| NEW            | PREPARING, CANCELLED |
| PREPARING      | READY, CANCELLED     |
| READY          | COMPLETED            |
| COMPLETED      | No subsequent status |
| CANCELLED      | No subsequent status |

Completion requires Paid. Paid cannot be reversed, and paid orders cannot be cancelled. Cancelled orders cannot be marked Paid. Refunds require a future dedicated process; there is no refund operation in this version.

### 8. API contract

Same-origin JSON API under `/api`. Authentication cookie: `estylo_token`, HttpOnly, SameSite=Strict, Secure when configured, 12-hour expiry. Mutations require the exact configured APP_ORIGIN plus `X-Estylo-Request: 1`. Cross-origin CORS is not enabled. Frontend requests include the marker automatically. Programmatic clients must set the Origin header to the configured origin and send the marker and authentication cookie.

| Route                    | Method | Permission / payload                                             |
| ------------------------ | ------ | ---------------------------------------------------------------- |
| /api/health              | GET    | Public; DB catalog query, returns status                         |
| /api/auth/login          | POST   | username, password; returns user and sets cookie                 |
| /api/auth/me             | GET    | Active authenticated identity                                    |
| /api/auth/logout         | POST   | Clears cookie                                                    |
| /api/products            | GET    | Staff; catalog                                                   |
| /api/products/{id}       | PATCH  | Admin: priceCentavos, active                                     |
| /api/orders?page=1       | GET    | Staff; 50 rows/page, total count, item snapshots                 |
| /api/orders              | POST   | Staff; order DTO + Idempotency-Key header                        |
| /api/orders/{id}         | PATCH  | Staff; status and/or payment                                     |
| /api/users               | GET    | Admin; safe account fields                                       |
| /api/users               | POST   | Admin: username, displayName, password, role                     |
| /api/users/{id}          | PATCH  | Admin: active boolean                                            |
| /api/audit               | GET    | Admin; latest 200 events                                         |
| /api/reports?from=…&to=… | GET    | Admin; count, paidCount, paidCentavos, open and status breakdown |
| /api/docs-json           | GET    | Generated OpenAPI description                                    |

Example order:

```json
{
  "customer": "Sample customer",
  "phone": "09123456789",
  "address": "",
  "fulfillment": "PICKUP",
  "source": "SMS",
  "items": [{ "productId": "valid-product-uuid", "quantity": 2 }]
}
```

Enums: fulfillment PICKUP/DELIVERY; source WALK_IN/SMS; payment UNPAID/PAID; status NEW/PREPARING/READY/COMPLETED/CANCELLED. Responses use NestJS errors: 400 invalid DTO or business fields, 401 absent/invalid/inactive session, 403 untrusted mutation origin or role, 404 missing record, 409 workflow conflict/duplicate record, 429 nginx login limit. The `/api/docs` Swagger UI may be constrained by production CSP; `/api/docs-json` is the portable API specification.

### 9. Responsive interface

Preserve reference branding while improving mobile access: management menu can be toggled on small phones instead of disappearing, tablet sidebar collapses to labeled icon links, cashier cart stacks below menu under 900px, and management cards adapt to width. Touch buttons/inputs are at least 44px; form inputs use 16px text to avoid Safari focus zoom. Fields have labels, errors have alert roles, keyboard focus is visible, reduced-motion settings are respected, and React escapes user text. Logo is locally served with contain sizing, preserving the whole coffee mark.

Target acceptance widths: 375×667, 390×844, 768×1024, 820×1180, 1024×1366, and landscape 1180×820. Chromium checks with mock API responses passed at all six sizes for login, menu/cart, SMS order submission and order-board navigation without horizontal overflow. See docs/browser-results.json and tests/responsive.cjs. Physical iPhone/iPad Safari validation remains required; responsive CSS is not a substitute for device testing.

### 10. Reports

Dashboard requests orders created since midnight in the browser's local timezone. Custom report date inputs use Philippine time (UTC+8). Default reports cover the last 30 days; date ranges are limited to 366 days. Report aggregation runs over all matching database orders, not only the current 50-row page.

Paid sales include Paid non-cancelled orders grouped by order creation time. They represent manual operational records, not revenue recognition or a payment reconciliation ledger. No payment timestamp or accounting export is present. Order status filter applies only to the selected page and is labeled accordingly. Audit view is limited to the latest 200 entries; retained data remains in the database.

### 11. Security and configuration

No fixed/demo Admin password or JWT secret is shipped. API refuses to start without JWT_SECRET of 32+ characters or APP_ORIGIN. Seed requires ADMIN_PASSWORD of 12+ characters and does not overwrite an existing Admin. JWT signing secret must remain consistent across restarts; rotating it invalidates sessions.

NestJS ValidationPipe uses whitelist, forbidNonWhitelisted and transformation. Nested item validation prevents malformed quantities/UUIDs. Argon2 hashes passwords. Prisma parameterization and tagged raw SQL bind values safely. HttpOnly strict cookies and trusted origin plus non-simple request marker protect browser mutations. Helmet and frontend CSP reduce browser attack surface; login nginx limit is 5/minute per IP with burst 5. API/database are private in Compose. Password hashes are never returned in user listings or audit events.

Production requires TLS, COOKIE_SECURE=true, a least-privilege DB account and secured backups. The provided connection role owns schema/migrations; split migration/runtime roles for hardened deployment. UI logout clears the cookie but does not centrally revoke a stolen token; disabling the account blocks access, and JWT rotation invalidates all tokens. Do not cache API responses or enable offline authenticated transactions. Do not commit `.env`.

### 12. Deployment and operations

Follow README. Docker API startup deploys migrations, seeds safely, then serves; frontend waits for DB/API readiness. Health checks query the catalog rather than only checking that the process is listening. Internal service names are api/db/web. Dockerfiles use Node 22 and nginx; Node API runs as the node user. Native dependencies should be built for target architecture. Raspberry Pi deployment requires supported 64-bit OS/Docker and ARM-compatible images; this environment has not validated a Pi build.

Set APP_ORIGIN exactly to browser scheme/hostname/port. Localhost and LAN IP are distinct origins. For iPad/iPhone LAN testing configure the LAN origin and open that origin consistently. Production should proxy HTTPS to frontend:8080 and use secure cookies. Configuring a reverse proxy/Cloudflare tunnel and certificates is an operator task.

Backup: `bash scripts/backup-db.sh` produces a PostgreSQL SQL dump under ignored `backups/`. Copy backups encrypted off-host. Restore helper accepts one SQL file and must target an empty recovery DB; test restores before promotion. `docker compose down -v` destroys the volume. Database upgrades/migrations require a tested backup and rollback/recovery plan. Logs: `docker compose logs api`, `docker compose logs web`. Configure external monitoring and backup schedules separately.

### 13. Upgrade from the prior coffee implementation

Version 2.0 replaces Flask/vanilla JavaScript with the reference's NestJS/React stack. It uses new Prisma tables/enums and a separate coffee database. Existing Python database records are not automatically migrated. Back up previous data and retain its deployment until any required import is reviewed. Do not point this migration at a populated unrelated barber database. The uploaded barber ZIP is a reference and is not overwritten.

### 14. Validation and remaining acceptance

Both production builds and TypeScript checks passed. All 14 unit tests passed. Automated API tests cover workflow restrictions, authoritative price snapshots, audit orchestration, same-key retries, missing-price rejection, delivery fields, DTO/unknown-field validation, Cashier/Admin authorization, missing cookies and deactivated users. Service tests mock database access, so they do not establish PostgreSQL rollback or concurrency behavior. The migration is generated from the Prisma schema with explicit numeric CHECK constraints.

A GitHub Actions workflow provisions PostgreSQL and runs the included tests/integration.cjs smoke suite for real database transactions, concurrent same-key requests, roles, payment transitions and deactivation. That PostgreSQL suite could not be executed in this environment. Docker/PostgreSQL integration and actual Apple Safari/Raspberry Pi acceptance remain outstanding. Run seed, account/price management, successful order creation, duplicate simultaneous retries, competing status updates, and a backup/restore exercise on the target PostgreSQL deployment before production. Use a fresh test database for acceptance.

### 15. Exclusions

No SMS sending/ingestion, inventory/recipes, sizes/modifiers, customer portal, delivery fees/routing, tax/discount engine, payment gateway/reconciliation, cash-change calculation, refunds/void financial ledger, receipts, password-reset/MFA, role editing, automatic data import, scheduled backups or monitoring. These require additional requirements and integrations.
