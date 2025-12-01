## Goals
- Allow supervisors to create users only within their own Group ID (auto-assign the supervisor’s `groupId`, no override).
- Support signup with username-only or email-only (either acceptable); groupId must belong to a supervisor group.
- Allow login using either username or email.
- Add a clear note on all dashboards: “1 credit = 1 SMS”, display the total SMS capacity from current credits; never show user/supervisor rates.

## Backend Changes
### Schema
- Add `users.username` (text, unique, not null), make `users.email` nullable.
- Safe init/migration sequence:
  1) `ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;`
  2) Backfill usernames for existing rows (prefer `name`, else email prefix, ensure uniqueness with numeric suffixes).
  3) Create unique index on `username` and set `ALTER TABLE users ALTER COLUMN username SET NOT NULL;`
  4) `ALTER TABLE users ALTER COLUMN email DROP NOT NULL;`

### Signup (`POST /api/auth/signup`)
- Accept `{ username?, email?, password, groupId, captchaToken }`.
- Require: at least one of `username` or `email`, `password`, and valid `groupId`.
- Resolve group ID by existing resolver; additionally ensure a supervisor exists with `users.group_id = resolvedGroupId`.
- Create user with provided `username`/`email`, assign `group_id` to resolved supervisor group.

### Login (`POST /api/auth/login`)
- Accept `{ identifier, password, captchaToken }`.
- Lookup by `username = identifier` first; fallback to `email = identifier`.

### Supervisor Create User
- New endpoint `POST /api/supervisor/users/create` (requireRole supervisor): body `{ username, email?, password }`.
- Server sets `group_id` to supervisor’s `group_id` automatically; role forced to `client`.

### Validation
- `username`: 3–32 chars, allowed `[a-z0-9._-]`, unique.
- `email`: optional, if present must be valid; remains unique.
- `groupId`: must resolve and have at least one supervisor owning it.

## Frontend Changes
### Signup Page
- Inputs: `Username (optional)`, `Email (optional)`, `Password`, `Group ID`, slider captcha.
- Helper text: “Provide username or email (at least one).”
- Show errors for `groupId_invalid`, `username_taken`, `email_taken`.

### Login Form
- Change label to “Username or Email” and post `identifier`.

### Admin Dashboard → User Create
- Add `Username` required, `Email` optional.
- Admin: keep role selector; Supervisor: hide role selector, lock group to badge with their group ID.
- Add translator tool (already present for IDs) remains.

### Credits Note on All Dashboards
- Add a small info banner: “1 credit = 1 SMS”.
- Compute capacity = `floor(profile.credits)` and display “You can send up to X SMS.”
- Do not render any rate fields for user/supervisor views.

## Display/Logs
- Prefer `username → email → raw id` for message activity and action logs.
- Retain translator next to search boxes for manual ID → name/email resolution.

## Rollout & Migration
1) Apply schema changes and backfill usernames.
2) Implement new routes (signup, login, supervisor create).
3) Update frontend pages (Signup, Login, Admin/Supervisor dashboards) and add credits banner.
4) Build, deploy, cache-bust; verify flows.

## Verification
- Supervisor creates a user → new user inherits supervisor `groupId`.
- Signup with only username + valid supervisor group ID → success.
- Login using username → success.
- Dashboards show “1 credit = 1 SMS” and capacity; no rates shown.
- Logs show usernames instead of UUIDs; translator resolves any legacy IDs.

## Notes
- No change to billing arithmetic; audit entries still do not charge.
- Backfill ensures existing accounts have unique usernames; conflicts resolved with suffixes.

Please confirm to execute the implementation, migrations, UI updates, and deployment.