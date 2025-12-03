## Why the Numbers Mismatch

* `IbikiSMS Balance` comes from the provider and is stored in `admin.pool` after sync (`server/routes.ts:1725–1734`).

* `Allocated Credits` is the sum of all client balances in `client_profiles.credits` shown in Admin Dashboard.

* When sends were not deducted correctly, client balances stayed too high while the provider balance decreased, creating `Allocated > IbikiSMS`.

* Known under‑deduction sources:

  * Inbox replies previously skipped deduction (`server/routes.ts:4448` now deducts 1 per reply).

  * Bulk counting was wrong (charged per batch, not per recipient); fixed to charge per recipient (`server/routes.ts:4027–4031`, `4124–4126`).

  * Some API-key send paths historically forwarded without debiting; patched to call `deductCreditsAndLog`.

* Recalculate sets `admin.pool` to provider balance and recomputes group pools, but it doesn’t change client credits; reconciliation must backfill missing debits.

## Evidence

* Recalculate endpoint: `server/routes.ts:1725–1756` sets `admin.pool` to provider and recomputes `group.pool.*`.

* Reconcile endpoint: `server/routes.ts:1772–1829` compares `message_logs` vs `credit_transactions` and deducts missing amounts from users, group pools, and `admin.pool`.

* Deduction paths:

  * Single: `server/routes.ts:3930–3936` (1 credit).

  * Bulk: `server/routes.ts:4027–4031` (per recipient).

  * Bulk Multi: `server/routes.ts:4124–4126` (per transformed message).

  * Inbox Reply: `server/routes.ts:4448–4456` (1 credit).

## Plan to Fix and Validate

1. Trigger reconciliation for all users (admin endpoint `POST /api/admin/reconcile-credits`) to backfill missing debits.
2. Run `POST /api/admin/recalculate-balances` to sync `admin.pool` and group pools with the provider after reconciliation.
3. Refresh dashboard data and verify:

   * `Allocated Credits` decreased to match actual historical usage.

   * `Remaining Credits = admin.pool − allocated` is non-negative.
4. Harden auth to avoid stale `?token=` requests causing intermittent 502/403:

   * Remove query‑token fallback from `authenticateToken` and rely on `Authorization: Bearer` headers only (`server/routes.ts:26–31`).
5. Validate future sends across all paths deduct instantly:

   * Send test `Single`, `Bulk`, `Bulk Multi`, `CSV`, and `Inbox Reply`; confirm 1 credit per SMS and pools update.

## Next Actions

* With your confirmation, I will run reconciliation and recalc now, disable the query‑token fallback on the server, deploy, and show the updated dashboard values with before/after totals.

