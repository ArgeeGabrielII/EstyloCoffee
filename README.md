# Estylo Coffee Tracker

A browser-based coffee shop management and ordering system built with **React 19 + Vite**, **NestJS + Prisma**, and **PostgreSQL 17**. It supports staff cashier operations, daily order queues, payment recording, onsite ordering, menu maintenance, reporting, and administration.

> **Production baseline:** On 9 November 2026, the Windows production machine deployed application commit **b0ca1dd4af524a87b4c721e20a08e41397ff799a** and successfully applied all six Prisma migrations. The [corresponding GitHub Actions run](https://github.com/ArgeeGabrielII/EstyloCoffee/actions/runs/42618052591) passed. **Changes to documentation alone do not require another production deployment.**

> **Current hosting:** Native **Windows + Node.js + PostgreSQL**, not Docker. Docker-related files remain for historical development context, but are **not the procedure used to operate or update the current production laptop**.

## Guides and navigation

- [Complete user guide](docs/USER-GUIDE.md) — staff and customer walkthroughs
- [Application pages](#application-pages)
- [Daily workflows](#daily-workflows)
- [Access and roles](#access-and-roles)
- [Development](#development)
- [Windows production operations](#windows-production-operations)
- [Recovery and troubleshooting](#recovery-and-troubleshooting)

## Application pages

**Configured shop-network origin:** http://estylo-coffee.local:8080. The hostname must resolve on the connected device. Use this origin exactly, rather than mixing localhost, IPs and hostnames.

| Route | Purpose | Role |
| --- | --- | --- |
| /login | Staff sign-in | Staff |
| /cashier | POS, cups, add-ons, order confirmation | ADMIN, CASHIER |
| /orders | Order board, payment and fulfillment | ADMIN, CASHIER |
| /dashboard | Daily KPIs | ADMIN |
| /reports | Daily/monthly sales and drink analytics | ADMIN |
| /maintenance/store-hours | Opening/closing times, end-of-day buffer and rollover status | ADMIN |
| /maintenance/products | Drinks and add-ons | ADMIN |
| /maintenance/payment-methods | Payment method configuration | ADMIN |
| /maintenance/users | Staff and guest accounts | ADMIN |
| /maintenance/audit | Searchable, paginated audit history | ADMIN |
| /onsite | Public onsite ordering; no login | Public |
| /queue | Public live queue display; no login | Public |

## Daily workflows

### Staff sign-in

1. Open http://estylo-coffee.local:8080/login.
2. Enter your individual **Username** and **Password**; click **SIGN IN**.
3. ADMIN lands on Dashboard; CASHIER lands on Cashier. Use **Sign out** when finished.

### Cashier order

1. On Cashier, tap a drink tile **once for each cup**. Each cup has its own add-ons.
2. Open **Add-ons** on a cup, adjust quantities, and select **Save add-ons**.
3. When permitted by shop policy, check **Free Drink** for an individual cup. Only its base coffee is free; **add-ons remain chargeable**.
4. Fill Customer Name, Phone, Fulfillment (Pickup/Delivery) and Source (Walk-in/SMS). **SMS and Delivery require customer name and phone; Delivery also requires address**.
5. Review **Total Cup Count** and **Total Amount**. Select **CREATE ORDER**.
6. Check the **Review & Confirm Order** dialog and press **Confirm Order**. No order is saved before final confirmation.
7. Note the assigned **daily queue number** and open **View Orders**.

An SMS order is manually entered by staff; no SMS inbox/sending service is included.

### Payments and preparation

1. In Orders, select the order and check its cups, total and status.
2. **Verify cash or external bank/GCash payment before clicking Confirm Payment**. The system only **records** payment; it does not charge an instrument or confirm a transfer.
3. Select an **active payment method** (initial migration: Cash, Bank Transfer, GCash), then press **Confirm Payment**.
4. Progress through **New Orders → Preparing → Ready for Pickup → Completed**. Completion requires paid status.
5. A New order can be cancelled or voided through a confirmation dialog. A paid void is **not an automatic refund**. Regular payment confirmation cannot be reversed.

### Public onsite ordering

1. Open http://estylo-coffee.local:8080/onsite on a connected phone/tablet.
2. Tap coffee tiles, choose per-cup add-ons and enter a name.
3. Review, then **Confirm Order**. The receipt shows queue number/reference and **UNPAID**.
4. Pay at the **cashier** and follow progress at http://estylo-coffee.local:8080/queue.

Onsite ordering requires an **active GUEST system account** whose ID is set as ONSITE_ACTOR_USER_ID in the backend configuration. A GUEST is not a normal login account.

### Store Hours maintenance and business-day rollover (new feature)

The admin-only **Maintenance → Store Hours** screen sets a recurring daily **Opening Time**, **Closing Time**, and a **Review Buffer** of 0–360 minutes (default: **60**). All times use Asia/Manila; overnight opening/closing is supported. Settings are validated so a shift plus review buffer does not overlap the next opening.

At closing time the **REVIEW** phase begins: **cashier and public onsite new-order creation stops**, while the current Dashboard and Orders board remain on the closing business day for reconciliation. The UI displays a closed-state notice, and the API rejects out-of-hours orders with HTTP 409. Existing orders may still be prepared or completed according to their status, but new sales are blocked. At **Closing + Buffer**, they automatically roll over to the next business day. Payment confirmations and voids for the prior business date become **automatically read-only**, even if no administrator clicked Finalize. The report selector follows the active business date unless an admin is browsing history. A date-specific report can still be opened for any previous period, and older unfinished orders remain available on the order board.

**Financial finalization:** During the REVIEW window, Maintenance → Store Hours shows order count, paid orders/sales, unpaid orders, and unfinished orders. An ADMIN may type **FINALIZE** to create a stored, audit-linked closing snapshot only when there are **no unpaid and no unfinished orders**. A manually finalized date is immediately financially locked. Financial writes to previous dates are rejected after automatic rollover even if no snapshot was created; incomplete orders stay visible but cannot be newly marked paid against the closed date. Reconciliation exceptions require a separate admin-supervised, audited adjustment process; there is no automatic refund or reopening of historical records. Do not leave orders unpaid past cutoff.

Each newly created order has a stored **businessDate**. Queue numbering uses that same date and starts at 1 after rollover; **no orders, sales, or audit records are deleted**. The additive migration `20261110080000_store_hours_business_day` backfills older orders to the original Philippine calendar date so historical records are not lost or reclassified when settings change. Subsequent settings edits affect **new** orders and live display boundaries, not the stored historical business dates. Store hours show an Open/Closed state but do **not** automatically prevent cashier or onsite orders outside those hours.

**Deployment warning:** This feature adds a seventh Prisma migration. It is **not installed on the production Windows machine** merely by merging this PR. The locally installed release updater is pinned to the previously deployed commit `b0ca1dd` and the prior three migration files. A fresh verified backup, reviewed migration SQL, a newly approved deployment script and successful smoke tests are mandatory before updating production.

### Admin maintenance and reports

- **Drinks & Add-ons:** two tabs, Add New Drink/Add New Add-On, active/inactive records, edit name/price/availability, **Save**. Historic orders retain stored price snapshots.
- **Payment Methods:** add a method, edit its name, toggle active status and **Save**. Only active methods can be selected during confirmation.
- **Users:** create ADMIN, CASHIER or non-login GUEST accounts; enable/disable other accounts; view/copy the onsite GUEST Account ID.
- **Dashboard:** Paid Sales, Paid Orders, Open Orders and status visuals in Philippine time.
- **Reports:** Daily/Monthly selection, month/year controls, cups/sales metrics and coffee/add-on breakdowns.
- **Audit Log:** search across fields, 30 entries per page with navigation.

## Access and roles

| Role | Access |
| --- | --- |
| ADMIN | All staff sections, maintenance, reports, audit |
| CASHIER | Cashier and Orders |
| GUEST | Backend identity for public onsite orders; no staff sign-in |
| Public customer | Onsite Ordering and Queue Display without authentication |

A customer cannot directly pay through the onsite page. Orders enter the workflow unpaid. The queue display shows active New, Preparing and Ready statuses. Orders created before daily queue numbering may have no queue number.

## Codebase layout

    apps/api/                     NestJS controllers and services
    apps/api/prisma/              Prisma schema, seed and versioned migrations
    apps/web/src/                 React UI, routing, cashier and admin screens
    apps/web/public/              Logo and static assets
    .github/workflows/ci.yml      Build, lint, tests, disposable DB integration
    scripts/                      Linux/macOS database helpers
    docs/USER-GUIDE.md            Operational tutorial

Browser → web server / reverse proxy → NestJS API (/api) → PostgreSQL.

## Development

Prerequisites: Git, Node.js 22+, npm, PostgreSQL 17 and a **nonproduction database**.

    npm ci
    cp .env.example .env

Configure your own database URL, a JWT secret of at least 32 characters, admin credentials, and the local development origin. The checked-in Vite proxy targets **http://localhost:3001** for API development.

Example **development-only** nonsecret values:

    PORT=3001
    APP_ORIGIN=http://localhost:5174
    COOKIE_SECURE=false

The root .env must be loaded into the environment before invoking Prisma within the API workspace; it is not automatically discovered there.

    set -a; . ./.env; set +a
    npm run db:generate
    npm run db:deploy
    # Development initial setup only, NEVER routine production upgrade:
    npm run db:seed
    npm run dev:api

In a separate terminal:

    npm run dev:web

Open http://localhost:5174/login.

**Never point integration tests, seed, reset or db-push at the live shop database.**

## Windows production operations

The current native production installation runs at **C:\EstyloCoffee** and uses:

- **PostgreSQL 17** at localhost:5432, database **estylo_coffee**
- Windows Scheduled Task **Estylo Coffee API** (configured API port 3000)
- Windows Scheduled Task **Estylo Coffee Web Server** (web/reverse proxy port 8080)
- Shop-network origin **http://estylo-coffee.local:8080**

Example **production nonsecret** environment values:

    APP_ORIGIN=http://estylo-coffee.local:8080
    COOKIE_SECURE=false
    PORT=3000

The actual ONSITE_ACTOR_USER_ID, DATABASE_URL, JWT_SECRET and credentials are private; **never publish or commit the production .env**. HTTP cookies are suitable only for the currently trusted local-network configuration. Use TLS and COOKIE_SECURE=true before public exposure.

### Windows scripts live on the laptop, not GitHub

The following files are **installed locally** in C:\EstyloCoffee\startup and **are not tracked in this repository**:

- **Update-EstyloCoffee.ps1** — controlled updater with read-only preflight and separately approved deployment mode
- **Update-EstyloCoffee.cmd** — invokes the PowerShell updater in an elevated shell
- **Backup-EstyloDB.ps1** — native PostgreSQL backup helper

The updater used for the November 2026 release was **pinned to commit b0ca1dd…** and an explicit three-migration allowlist. It **will refuse a newer main commit**, including documentation-only commits, until deliberately reviewed/reconfigured. **Do not run it for README changes, and do not bypass its protections.**

### Checklist for a future application release

1. Confirm the target application's GitHub Actions CI is green (build, lint, tests and isolated PostgreSQL migration/integration).
2. Review changes and every new/modified Prisma migration SQL. Validate compatibility with existing orders and production schema.
3. Schedule downtime and stop accepting new orders.
4. Verify the exact local production database target and Windows task state.
5. Take a **fresh verified backup**, preferably with a test restore to a separate database and an off-machine encrypted copy.
6. Review/update the **local** updater's pinned commit and migration allowlist; preserve production .env.
7. Run preflight in Administrator PowerShell, read its output, and only then run its explicitly approved deployment mode. The reviewed updater includes npm ci, db:generate, build, **db:deploy**, and migration status checks.
8. Confirm API health, login, historic orders, order creation, payment confirmation, onsite and queue behavior.
9. Keep the deployment transcript and backup path. If deployment stops, inspect the error first; **never automatically restore over the live DB or run prisma migrate reset**.

**Do not run unreviewed deploys because documentation was merged into main.** Documentation-only commits do **not** require redeployment.

## Recovery and troubleshooting

| Issue | First check |
| --- | --- |
| Login or an API action fails / untrusted origin | Use exact shop hostname and matching APP_ORIGIN; check staff account |
| Drink unavailable in POS | Maintenance: active/Available and valid price |
| Payment method not listed | Maintenance: method is Active |
| Onsite ordering fails | Active GUEST account, ONSITE_ACTOR_USER_ID, API health |
| Old orders lack queue numbers | Orders created before daily queue migration were intentionally left unnumbered |
| Queue empty | Public queue displays only active New/Preparing/Ready orders |
| Updater rejects a newer main SHA | It is pinned for the reviewed release; **do not bypass the guard** |
| Web/API unreachable | Windows tasks, local ports and deployment logs |
| Vite >500 KB chunk warning | Performance advisory, not automatically a failed build |

Current Windows backup directory: **C:\Users\Administrator\Documents\EstyloCoffee\Backups**. Deployment transcripts are in **C:\Users\Administrator\Documents\EstyloCoffee\DeploymentLogs**. The successful 9 November release reported archive **estylo_coffee_2026-11-09_205830.dump**.

A readable pg_restore archive is a **backup integrity check, not a complete restore test**. Restore deliberately into a separate recovery database before planning a recovery cutover. Never restore over production casually.

## Validation

The GitHub workflow tests an **isolated PostgreSQL** database and runs dependency install, Prisma generate/deploy/seed, build, lint, unit tests and integration tests.

    npm run build
    npm run lint
    npm test

Integration tests require **INTEGRATION_TEST_DATABASE=true** and an explicitly **disposable test DB**. Never run them against production.

**Validated application baseline:** [b0ca1dd GitHub Actions](https://github.com/ArgeeGabrielII/EstyloCoffee/actions/runs/42618052591).

## Safety and limitations

- Payment recording is **manual confirmation**, not automatic payment settlement.
- SMS orders are **staff-entered**, not automatically collected from incoming texts.
- The public onsite page is intentionally unauthenticated and uses a separate backend GUEST identity.
- Protect production secrets, backup archives and the Windows host. Do not put personal account IDs or credentials in public documentation.
- This README documents the source at b0ca1dd and the production configuration confirmed by its operator, not an independent remote inspection of the private shop laptop.
