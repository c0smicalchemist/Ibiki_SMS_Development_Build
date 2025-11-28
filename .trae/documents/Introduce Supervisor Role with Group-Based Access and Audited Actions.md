## Overview
- Add a new role `supervisor` with access between `user` and `admin`.
- Introduce `groupId` for users to scope supervisor visibility.
- Allow `groupId` assignment via Admin Dashboard and during Signup.
- Restrict supervisor UI/endpoint access, while enabling Supervisor Mode in operational pages.
- Replace “ExtremeSMS” label references in Credits Overview with “IbikiSMS”.
- Add a Supervisor Actions log tab in Admin Dashboard, with server-side auditing of privileged operations.

## Data Model & Migrations
1. Schema updates (Drizzle):
   - `users` table: add `groupId text` column; add `index(group_id)`.
   - Extend `users.role` value set (string) to accept `supervisor`.
   - New table `action_logs`:
     - `id varchar pk`, `actorUserId varchar`, `actorRole text`, `targetUserId varchar null`, `action text`, `details text`, `createdAt timestamp default now()`; indexes on `actorUserId`, `createdAt`.
2. Migrations:
   - Create migration SQL for the above changes; ensure non-breaking defaults (`groupId null`).
3. MemStorage support:
   - Update in-memory `User` entity to include `groupId`.
   - Implement `createActionLog`, `getActionLogs` in MemStorage to support audit in non-DB fallback.

## Auth & Role Middleware
1. Add `requireRole` helper allowing `admin` and/or `supervisor` as permitted roles.
2. Update endpoints:
   - For read-only client listings: permit `supervisor`, but filter by `groupId`.
   - For privileged mutations (rate limit, delivery mode, webhook): keep `admin` only.
3. Signup:
   - Accept `groupId` (optional) in `/api/auth/signup`; store in `users.groupId`.

## Server Endpoints
1. User role management:
   - New `POST /api/admin/users/:userId/role` (admin-only) to set role: `admin|supervisor|client`.
2. Group assignment:
   - New `POST /api/admin/users/:userId/group` (admin-only) to set `groupId`.
3. Client listing:
   - `GET /api/admin/clients`: if `admin`, return all; if `supervisor`, return only users with same `groupId`.
4. Audit logging:
   - Wrap supervisor-visible operations to record logs:
     - Credits adjust endpoints, delete/purge, enabling/disabling users, direct-mode actions.
   - Implement `logAction(actorUserId, actorRole, targetUserId, action, details)` utility.
   - Add `GET /api/admin/supervisor-logs?limit=&userId=` (admin-only; optional filters).

## UI Changes – Admin Dashboard
1. Clients table:
   - Add `Role` dropdown (Admin/Supervisor/User) with server integration.
   - Add `Group ID` editable field for each user (admin-only).
   - If `supervisor` is logged in:
     - Show Clients tab but list filtered by shared `groupId`.
     - Hide columns and actions for `rate limit`, `delivery mode`, `webhook`, and any admin-only actions.
2. Tabs visibility:
   - Hide Configuration, Webhook, API Testing tabs for `supervisor`.
   - Add new tab “Supervisor Logs” (admin-only): table of action logs with search/filter and pagination.
3. Credits Overview wording:
   - Replace “ExtremeSMS” with “IbikiSMS”; update descriptions accordingly.

## UI Changes – Operational Pages
1. Supervisor Mode (analogous to Admin Mode):
   - Send SMS, Inbox, Contacts, Message History:
     - If role is `supervisor`, display “Supervisor Mode” toggle and client selector limited to shared `groupId`.
     - Disable hidden admin-only functions, but allow viewing/acting within permitted scope.
2. Label/translation updates for zh:
   - Add zh translations for “Supervisor Mode”, “Role”, “Group ID”, “Supervisor Logs”.

## Frontend Integration Details
1. Role & group input:
   - Signup page: add `Group ID` input and pass to `/api/auth/signup`.
2. Admin dashboard controls:
   - `setUserRole(userId, role)` and `setUserGroup(userId, groupId)` mutations.
3. Filtering behavior:
   - Queries keyed by role apply filter on `groupId` for `supervisor`.
4. Visibility gates:
   - Use role checks to hide tabs and columns.

## Auditing Scope
- Log entries for `supervisor` actions:
  - Credits adjusted, user enable/disable, purge/delete, direct-mode actions (acting as client), phone assignments, business name changes.
- Log fields:
  - `actorUserId`, `actorRole`, `targetUserId`, `action` (enum-like text), `details` (JSON or text), `createdAt`.

## Testing & Validation
1. Migration safety: run migration locally, verify `users.groupId` defaults and index creation.
2. Signup path: ensure `groupId` stored and visible in admin.
3. Supervisor view:
   - Log in as supervisor; verify Clients tab shows only same `groupId` users.
   - Confirm tabs hidden and columns filtered.
4. Audit logs: perform sample operations as supervisor; verify entries in Admin Logs tab.
5. Credits Overview labels: confirm IbikiSMS wording on dashboard.

## Rollout Plan
1. Ship DB migration; deploy server changes.
2. Deploy frontend with role-aware gates and new controls.
3. Create at least one supervisor user and a few clients with shared `groupId`; validate scope.
4. Monitor audit logs for correctness.

## Notes
- All admin-only mutations remain server-enforced (`requireAdmin`), regardless of UI gating.
- `groupId` is a simple text key; if you prefer UUIDs later, we can add validation and mapping.
- Action log volume can grow; we’ll paginate and add indexes for performance.

Please confirm this plan. After confirmation, I’ll implement the schema, endpoints, UI updates, translations, and audit logging, and then build and deploy.