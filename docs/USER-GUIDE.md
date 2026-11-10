# Estylo Coffee — Step-by-step User Guide

**Version 1.1 • 10 November 2026 • Application baseline 3b8c995 + pending overnight-preview enhancement**

This guide covers the current UI and is based on code in the repository. For **illustrated screen maps**, refer to the separate downloadable **Estylo Coffee Illustrated User Guide (Word)**. Its pictures are **training illustrations**, not actual screenshots of the local production application.

## Quick links

- **Staff sign-in:** http://estylo-coffee.local:8080/login
- **Cashier:** http://estylo-coffee.local:8080/cashier
- **Orders:** http://estylo-coffee.local:8080/orders
- **Onsite Ordering:** http://estylo-coffee.local:8080/onsite
- **Queue Display:** http://estylo-coffee.local:8080/queue

The hostname must resolve within the shop network.

## 1. Staff login

1. Open **/login**.
2. Enter your **Username** and **Password**, then press **SIGN IN**.
3. ADMIN opens Dashboard, while CASHIER opens Cashier.
4. Use **Sign out** when finished. Do not share account passwords.

**Navigation:** Operations offers Dashboard, Cashier, Orders and Reports as authorized. Public Pages opens Onsite Ordering and Queue Display in new tabs. ADMIN sees Maintenance with Store Hours, Drinks & Add-ons, Payment Methods, Users and Audit Log.

## 2. Take a cashier order

1. Open **Cashier**.
2. Tap a drink tile in **COFFEE MENU** once per cup; each tap creates an individually customizable cup.
3. For an individual cup, tap **Add-ons**, change counts using **+ / −**, then **Save add-ons**.
4. If shop policy permits, select **Free Drink** for a cup. **Only the base drink becomes free. Add-ons still cost money.**
5. Fill in customer details and select **Fulfillment: Pickup/Delivery** and **Source: Walk-in/SMS**.
6. For **SMS** or **Delivery**, provide both **Customer Name** and **Phone**. **Delivery** additionally requires an address.
7. Verify **Total Cup Count** and **Total Amount**. Press **CREATE ORDER**.
8. Review the dialog; use **Back to Edit** if needed, or press **Confirm Order**.
9. Read the daily **Queue #** and choose **View Orders** to continue.

**Important:** The order is only stored after the final **Confirm Order** action. SMS is manually transcribed by a staff member; this app does not read or send messages automatically.

## 3. Track, prepare and complete orders

1. Open **Orders**. Select **New Orders**, **Preparing**, **Ready for Pickup**, **Completed** or **Cancelled**.
2. Select the customer/order card to open **Order Details**.
3. Review queue number, cups, add-ons, customer, fulfillment, payment and total.
4. Press **Start Preparing** to start, then **Ready for PickUp** when done.
5. Once paid and ready, press **Complete Order**.

Older pending orders are shown in a separate section. The public queue displays **In queue**, **Preparing** and **Ready** only.

## 4. Manually confirm payment

1. **Verify money received outside the application** first (cash, bank transfer or GCash).
2. In **Orders**, select the unpaid order and choose **Confirm Payment**.
3. Select an **active** payment method and check the amount.
4. Press **Confirm Payment**; verify the order now says **PAID**.
5. Payment confirmation cannot be undone through the normal workflow.

**Cancel vs void:** Cancel or void only while the order is **New**, using the explicit confirmation dialog. A paid void does not automatically refund money.

## 5. Customer onsite ordering

1. On a connected phone/tablet, open **/onsite** (no customer sign-in needed).
2. Tap one drink tile **per cup**, and customize it with **Add-ons** if desired.
3. Enter **Name for your order**.
4. Review the selected cups, total and details; press **Confirm Order**.
5. Save or note the **queue number/order reference** on **Order Received!**.
6. The order displays **UNPAID**; **proceed to the cashier to pay**.
7. Follow order progress on **/queue**.

No phone number or payment gateway is required on /onsite.

## 6. Set store hours and reconciliation buffer (ADMIN)

1. Open **Maintenance → Store Hours**.
2. Enter the recurring **Opening time** and **Closing time** in Philippine Time (24-hour clock). For an overnight shift, enter **14:00** for opening and **01:00** for closing. **01:00 is automatically interpreted as 1:00 AM the next calendar day.** Do not enter a separate closing date.
3. Set **End-of-day review buffer** to **60** minutes for a 1:00–2:00 AM reconciliation window (configurable **0–360**).
4. In the updated **Preview opening, closing, and reconciliation dates** panel, select **November 10, 2026** as the *preview business date*. Verify the illustrated timeline below. The date picker previews a recurring schedule; it **does not** make settings effective on that future date or schedule a one-time closing.
5. Select **Save Store Hours**. The recurring opening/closing times take effect as soon as saved. The page shows the active **Business Date**, **Closing Time**, **Automatic Rollover**, and whether the store is Open, Closed, or in Review.
6. At closing, **new cashier and onsite orders are blocked**. During the review window (after close, before rollover), use the **Review Dashboard**, **Review Orders**, and **Review Reports** links to reconcile payments, quantities, and unfinished orders. Existing orders may still progress through preparation, and payments remain confirmable until finalization/cutoff.
7. The **End-of-day reconciliation** panel shows paid sales, unpaid and unfinished counts. Resolve all unpaid/unfinished orders, then enter **FINALIZE** and click the finalization button to capture an auditable financial snapshot and immediately lock that day's payments and voids. Admin-only. Do not finalize prematurely.
8. Once closing + buffer is reached, prior-day financial records become read-only even if you did not press Finalize. The live Dashboard and today's Orders board start a new business day. The Reports page defaults to that business date while still allowing historical dates. Older unfinished orders remain accessible; recorded transactions are never deleted.

### Overnight example: 10–11 November 2026

| Event | Local date and time (Asia/Manila) | Business date |
| --- | --- | --- |
| Store opens | Tue, Nov 10 at **2:00 PM** | 2026-11-10 |
| Still selling after midnight | Wed, Nov 11 at **12:30 AM** | 2026-11-10 |
| Store closes / review begins | Wed, Nov 11 at **1:00 AM** | 2026-11-10 |
| Admin cross-checks sales | Wed, Nov 11 at **1:00–1:59 AM** | 2026-11-10 |
| Rollover / financial cutoff | Wed, Nov 11 at **2:00 AM** | 2026-11-11 |
| Next opening | Wed, Nov 11 at **2:00 PM** | 2026-11-11 |

**Date picker clarification:** The Daily Schedule settings are *recurring*; only times and review buffer are saved. The new date selector is named **Preview business date**. Use it to see how a chosen future business date crosses midnight; it does not schedule a new effective date. If you need a *future-effective change* to opening hours rather than a preview, that feature has not been implemented.

**Important:** The API rejects new cashier and onsite orders outside opening hours. Store reconciliation is for checking existing orders, not accepting new sales. If an unpaid order survives the automatic cutoff, it stays visible but cannot be paid against the closed business day. Escalate to an administrator for a separate audited adjustment rather than reopening old sales. Changing settings does not rewrite past orders’ saved business dates; queue numbering restarts on the new business date. The review buffer cannot overlap the following day’s opening.

## 7. Drinks and add-ons (ADMIN)

1. Open **Maintenance → Drinks & Add-ons**.
2. Choose **Drinks Maintenance** or **Add-On Maintenance**.
3. To create, enter **Name**, **Price (PHP)** and, for drinks, **Available**. Select **Add Drink** or **Add Add-On**.
4. To edit, find the row under **Active** or **Inactive**, modify name/price/availability, and press **Save**.
5. Confirm the updated available drink is selectable in Cashier.

Historic orders keep their original price snapshots. Changing today's menu does not rewrite prior order amounts.

## 8. Payment methods (ADMIN)

1. Open **Maintenance → Payment Methods**.
2. Under **Add Payment Method**, enter the name and select **Add Method**.
3. Edit a method's name and **Active/Inactive** status, then select **Save**.
4. Only **active** methods appear during payment confirmation.

The migration initially creates Cash, Bank Transfer and GCash.

## 9. Users and onsite system account (ADMIN)

1. Open **Maintenance → Users**.
2. Under **Create User**, enter Username, Display Name, Password (**12+ characters**) and Role.
3. Choose **CASHIER** for order operators, **ADMIN** for trusted administrators, or **GUEST** for the public onsite ordering backend actor.
4. Press **Create User**.
5. Under **User Accounts**, select **Enable** or **Disable** as needed.
6. Under **Onsite Guest Account**, copy the Account ID of an active GUEST user. A system administrator sets the matching value as **ONSITE_ACTOR_USER_ID** in the backend .env; do not put it in public documents.

GUEST is an attribution identity, **not a staff login**.

## 10. Reports, dashboard, and audit (ADMIN)

- **Dashboard:** Current business-day Paid Sales, Paid Orders, Open Orders and status visuals. Refreshes automatically.
- **Reports:** Choose **Daily** or **Monthly**, then Month and Year; use **Previous**, **Next** or **Current Period**. Use **Current Business Day** for the daily breakdown. Historical reports remain available.
- **Audit Log:** Use **Search** / **Clear** and **First / Previous / Next / Last** pagination (30 records per page).

All reporting dates use Philippine time.

## 11. Common problems

| Symptom | First action |
| --- | --- |
| Login / mutation says untrusted origin | Open the exact configured hostname and have admin verify APP_ORIGIN |
| Drink not available | Admin checks price and Available |
| Method missing in payment dialog | Admin checks whether it is Active |
| Cannot complete order | Must be Ready **and** payment confirmed |
| Onsite create fails | Admin checks active GUEST, ONSITE_ACTOR_USER_ID, API and menu |
| Queue blank | Public queue shows active statuses only |
| Historic order missing queue # | Older orders existed before daily queue migration |
| Closing time appears earlier than opening | This is normal for overnight hours; 01:00 after 14:00 means the following calendar day |
| Cannot select a future **closing** date | Select a **preview business date** to see the calculated calendar dates; no separate closing-date field is needed |
| Need a future-effective change | Preview is not scheduling: saving Store Hours applies the recurring schedule immediately |
| New order is rejected during reconciliation | New intake stops at closing; use 1:00–2:00 AM only to reconcile existing orders |
| Old unpaid order cannot be confirmed after cutoff | Prior-day financial changes are locked; escalate through a separate audited adjustment process |

**Safety:** Do not run development database reset, seed or integration tests on the live Windows production database. Routine software deployments follow the separate controlled Windows process described in README.md.
