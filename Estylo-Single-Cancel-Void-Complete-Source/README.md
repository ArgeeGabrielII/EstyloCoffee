Estylo Coffee - One cancellation button per NEW order

Replace apps/web/src/pages/OrdersPage.tsx with the included complete file.

NEW unpaid orders: Cancel Order -> confirmation -> PATCH /orders/:id status CANCELLED.
NEW paid orders: Void Transaction -> confirmation -> POST /orders/:id/void.
No cancellation or void action appears after NEW.

Requires backend NEW-only restrictions from previous cancellation-policy upgrade.

Build: npm --prefix apps/web run build
Commit: git add apps/web/src/pages/OrdersPage.tsx && git commit -m "feat(orders): consolidate cancel and void action" && git push origin main
