## Backups
- Local snapshot: zip `client/`, `server/`, `shared/`, `.env*`, `package.json`, `package-lock.json` into `release/ibiki-snapshot-<timestamp>.zip` and write a status file.
- Git snapshot: commit current state and create a backup branch `backup/pre-adminsup-<timestamp>` pushed to origin.

## Route Split
- Add `ProtectedSupervisor` guard.
- Register `/adminsup` → `AdminDashboard` wrapped by `ProtectedSupervisor`.
- Keep `/admin` for admins wrapped by `ProtectedAdmin`.

## Redirects
- Login redirect:
  - admin → `/admin`
  - supervisor → `/adminsup`
  - user → `/dashboard`

## Navigation Updates
- Update back links in role-aware pages to return to `/adminsup` for supervisors, `/admin` for admins:
  - `SendSMS.tsx`, `Inbox.tsx`, `Contacts.tsx`, `MessageHistory.tsx`.

## Role UI Consistency
- AdminDashboard: enforce role-based tabs/columns; supervisor → Clients + Logs only.

## Verification
- Supervisor (c0smicalchemist) lands at `/adminsup`; navigating in/out of tiles stays on `/adminsup`.
- Admin (ibiki_dash) stays on `/admin`.
- No external domain redirects.

Confirm and I will perform the backup and implement the changes, then deploy and verify.