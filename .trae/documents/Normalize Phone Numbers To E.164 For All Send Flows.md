## Overview
Clients report replies from Ibiki aren’t reaching mobiles, and some inbound replies aren’t landing in the correct inbox. The two‑way path needs hardening: normalize phone numbers, reliably bind modem/port per conversation, and make inbound routing deterministic.

## Diagnosis Summary
- Reply path (`/api/web/inbox/reply`, `/api/v2/sms/reply`) depends on `usedmodem` and `port` from the last inbound. If missing or stale, ExtremeSMS may send via an unintended modem/port and delivery fails.
- Recipient formatting inconsistencies (e.g., `180...` vs `801...` vs `+180...`) can cause provider-side routing issues; all sends must be E.164.
- Inbound webhook routing prefers `business` name; duplicates or mismatches can misroute. Conversation-based fallback works only if recent outbound exists and numbers are normalized.

## Implementation Plan
### 1) Enforce E.164 Normalization Everywhere
- Normalize `to`, `from`, and `receiver` (reply, single, bulk, multi, CSV, group recipients) to E.164.
- Rules (NANP): 11 digits starting with `1` → `+` + digits; 10 digits → `+1` + digits; `00/011` → `+`; keep valid `+E.164`.
- Deduplicate recipients post-normalization; reject invalids.

### 2) Conversation Modem/Port Binding
- Persist a conversation map keyed by `(userId, contactE164)` with `usedmodem`, `port`, and timestamp whenever inbound arrives.
- Reply endpoints:
  - Lookup conversation; include `usedmodem` and `port` in provider payload.
  - If missing, fallback to the client’s assigned sending number → resolve default modem/port via mapping; if still unknown, return a clear error to UI.
- Refresh binding if provider reports modem/port invalid.

### 3) Webhook Routing Hardening
- Normalize inbound `from`/`receiver` to E.164 before routing.
- Routing order:
  1) Business name exact (case-insensitive) → client profile
  2) Recent conversation by `from` → client
  3) Owner of `receiver` number → client
  4) Admin default business
- Log routing decisions and failures; store inbound even if unassigned, and auto-create contact with normalized `from`.

### 4) Business Name Uniqueness (IBS_<n>)
- Auto-generate unique `IBS_<n>` on user creation when `businessName` missing or collides (case-insensitive).
- Ensures business-based routing remains deterministic.

### 5) Credit Deduction Consistency
- Ensure non-admin/supervisor sends always call `deductCreditsAndLog` (Web and API v2), using group pricing for both pre-checks and final charges.
- Log before/after credits, message count, rate, and total debit.

### 6) Verification Scenarios
- Test reply to `(769) 284-1541` → normalized `+17692841541`:
  - Inbound webhook routes to Xiaoxin inbox; conversation binding recorded.
  - Reply from Ibiki includes bound `usedmodem`/`port`; provider acknowledges; mobile receives.
- Send samples with `180...`, `801...`, `+180...` and confirm ExtremeSMS shows `+180...`.
- Confirm credits deduct correctly using group rates; pre-check matches final charge.

### 7) Rollout
- Implement normalization & binding, add logs, update user creation for `IBS_<n>`, adjust pre-check pricing, and deploy.
- Monitor logs for delivery confirmations and webhook intake; provide a short report.

## Ready to proceed?
On approval, I will implement and deploy immediately, then verify reply delivery and webhook routing within the window you specified.