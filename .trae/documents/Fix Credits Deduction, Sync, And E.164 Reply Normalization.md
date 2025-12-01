## Goals
- Make credits deduct exactly 1 credit per SMS for users, supervisors and group pools, and reflect in admin overall (IbikiSMS Balance) without redistribution.
- Fix sync so the dashboard IbikiSMS Balance reflects Extreme’s balance, and Remaining Credits = Provider − Allocated.
- Enforce strict NANP/E.164 normalization for all sends and replies, including inbox replies (e.g., 6624908672 → +16624908672).

## Implementation
### 1) Server‑Side Normalization
- Central utility: use shared normalizer for all flows with default country `+1`.
- Apply in:
  - Web send: single, bulk, bulk‑multi
  - API v2 send: single, bulk, bulkmulti
  - CSV import and contacts enrichment
  - Webhook inbound (`from`, `receiver`) and inbox reply (`to`)
- Rules:
  - 11 digits starting with `1` → add only `+`
  - 10 digits → add `+1`
  - `00/011` → convert to `+`
  - Already `+E.164` → keep
  - Deduplicate; reject invalids

### 2) Per‑Message Deduction = 1 Credit
- Update pricing retrieval so `clientRate` = 1 credit/message (group override supported; fallback/default 1).
- Ensure all send endpoints pass `messageCount` correctly:
  - Single: 1
  - Bulk: normalizedRecipients.length
  - Bulk‑multi: normalized valid messages length
- Deduct from:
  - Sender’s balance (user or supervisor in direct mode)
  - Group pool `group.pool.<groupId>` by the same amount
  - Admin overall pool by the same amount (see next section)

### 3) Admin Overall (IbikiSMS Balance) And Sync
- Track `admin.pool` (credits) reflecting Extreme’s balance.
- On every send, decrement `admin.pool` by `messageCount`.
- Sync button:
  - Fetch Extreme account balance
  - Update `admin.pool` to exact provider balance (no redistribution)
  - Compute Remaining Credits = `admin.pool` − Sum(allocated client credits)
- Auto‑refresh on dashboard every 10s; show sync status.

### 4) Inbox Reply Normalization
- For replies, normalize the recipient with default `+1` if it lacks country code.
- Use conversation modem/port binding; if binding missing, include normalized `to` and default modem/port mapping.

### 5) Verification
- Send tests: 10‑digit (`2365478963`) → `+12365478963`, 11‑digit (`12365478963`) → `+12365478963`.
- Bulk tests: counts reflect true normalized recipient totals; user/group/admin pools deduct accordingly.
- Sync: IbikiSMS Balance equals Extreme balance after pressing Sync.
- Inbox reply: mobile receives replies; inbox shows normalized numbers.

### 6) Deploy
- Build server/client, deploy, restart PM2, verify health and dashboard values.

## Deliverables
- Updated normalization, deduction and sync logic, plus dashboard auto‑refresh.
- Deployment complete and verified.

## Confirm
Proceed to implement and deploy these changes now?