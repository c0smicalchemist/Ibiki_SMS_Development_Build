## Goals
- Supervisors can create users only within their own Group ID (auto-assigned, non-editable).
- Signup supports username-only or email-only; groupId must match a supervisor’s group.
- Login accepts either username or email.
- Dashboards show "1 credit = 1 SMS" and estimated SMS capacity based on credits; do not show rate/cost to users or supervisors.

## Backend Changes
### Schema & Migration
- Add `users.username` (text, unique, not null).
- Make `users.email` nullable (unique when present).
- Safe init/migration:
  1) `ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;`
  2) Backfill `username` (prefer `name`; fallback to local-part of email; de-dup with numeric suffixes).
  3) `CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);` then set `username` NOT NULL.
  4) `ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`

### Signup (`POST /api/auth/signup`)
- Body: `{ username?, email?, password, groupId, captchaToken }`.
- Validation: require at least one of `username`/`email`; require `password`; require `groupId`.
- Resolve `groupId` as today, then enforce existence of a supervisor with that same `group_id`.
- Create user with `group_id` set to resolvedGroupId.

### Login (`POST /api/auth/login`)
- Accept `{ identifier, password, captchaToken }`.
- Lookup by `username=identifier` first; fallback to `email=identifier`.

### Supervisor Create User
- New `POST /api/supervisor/users/create` (require supervisor):
  - Body: `{ username, email?, password }`.
  - Role forced to `client`.
  - `group_id` auto-assigned from supervisor; reject if supervisor has no group.

### Data Enrichment for Logs (unchanged behavior, plus)
- Prefer `username` → `email` → raw id in log enrichers returned to UI.

## Frontend Changes
### Signup Page
- Add `Username (optional)` and `Email (optional)` inputs with note "Provide at least one".
- On submit, send whichever is provided.

### Login Page
- Rename Email input to `Username or Email`; post as `identifier`.

### Admin Dashboard → User Create
- Add `username` input; `email` optional.
- For supervisors: hide role selector, role always client; remove Group ID input; show badge "Group: <myGroupId> (auto-assigned)".

### Dashboards Credit-to-SMS Note (User & Supervisor)
- In `DashboardHeader` and relevant cards, display:
  - "1 credit = 1 SMS"
  - "Estimated SMS available: <floor(credits)>"
- For supervisor group summaries, show group remaining credits and estimated SMS: `floor(groupRemainingCredits)`.
- Ensure no rate/cost fields are rendered for users/supervisors (already removed; keep hidden).

## Migration & Rollout
1) Add `username` column and backfill; create unique index and enforce NOT NULL.
2) Relax `email` NOT NULL.
3) Deploy backend; update frontend forms and dashboards; cache bust.
4) Verify flows.

## Verification Steps
- Supervisor creates a user: confirm new user has the same `groupId`.
- Signup with only username and valid supervisor `groupId`: confirm success.
- Login using `username`: confirm success.
- Dashboards show credit-to-SMS notes; no rate or cost visible for users/supervisors.
- Logs show username or email instead of UUID.

If this plan looks good, I’ll implement the schema changes, routes, and UI updates, then deploy and validate end-to-end.