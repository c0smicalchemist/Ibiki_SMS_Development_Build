## Diagnosis
- Allocated Credits is the sum of all `client_profiles.credits` while IbikiSMS Balance is the provider/admin pool fetched from ExtremeSMS.
- Credits have been deducted using the group/client rate (e.g., `0.03`) instead of a fixed 1 per SMS; some send paths previously under-counted bulk messages and some replies weren’t charged, leading to over-allocation vs provider balance.
- Purge/restart moments caused 502s and some old UI calls still use `?token=`; intermittent failures prevented consistent reconcile runs.

## Server Changes
- Enforce “1 SMS = 1 credit” everywhere:
  - Change `deductCreditsAndLog` to use `creditsToDeduct = messageCount` for user/supervisor/admin pools.
  - Persist USD pricing separately: keep `chargePerMessage` as USD (group/client rate) only for reporting; do not use it for credit deduction.
  - Ensure all send endpoints pass correct `messageCount`:
    - Single: 1
    - Bulk: `normalizedRecipients.length` after dedupe/validation
    - Bulk Multi: `messages.length` of transformed items
    - CSV: valid recipient count
    - Inbox reply: 1
- Reconciliation logic:
  - Compute expected credits strictly as `message_count * 1` per log (ignore USD rate for deduction).
  - Apply missing deductions to `client_profiles.credits`, reduce `group.pool.<gid>` and `admin.pool` accordingly.
  - Make reconciliation resilient and idempotent; include nightly auto-run and admin manual trigger.
- Admin allocation and USD valuation:
  - Keep credits as the only deducting balance for sending.
  - Use group/client rate only to compute dollar value at allocation time; record USD value in transaction description (no change to credit math).
  - Add endpoint behavior that returns both credits and computed USD for UI.
- Auth/502 hardening:
  - Remove token query fallback; require `Authorization: Bearer` headers across all protected endpoints to avoid stale token issues.
  - Keep cache purge async-only to avoid visible 502 during admin actions.

## Client Changes
- Admin Dashboard Adjust Balance dialog:
  - Show two fields: `Amount (credits)` and `Value (USD)` where USD is auto-computed via group/client rate (e.g., `5000 × 0.03 = $150`).
  - Restrict this control to admin.
- Credits Overview:
  - “Remaining Credits” displays `IbikiSMS Balance − Allocated Credits` after reconcile/recalc.
  - Remove/resolve “Needs Sync” once reconcile+recalc succeed and polling shows parity.
- Requests:
  - Ensure all fetches use `Authorization: Bearer` header only; no `?token=`.

## Backfill & Verification
- Run reconciliation to deduct any missing credits historically; verify:
  - Allocated Credits ≤ IbikiSMS Balance
  - Every send deducts exactly 1 credit per SMS.
- Validate bulk/multi/CSV counts and inbox reply deductions via sample users.

## Rollout
- Implement server and client changes.
- Build and deploy.
- Run admin “Reconcile” and “Recalculate Balances”.
- Confirm dashboard parity and perform targeted checks for known users/groups (e.g., MG888) with the new USD valuation display.

Do you want me to proceed with these changes now and deploy?