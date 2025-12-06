## Goals
- Users: see their own inbox
- Supervisors: see their own inbox and the inbox of users in their group
- Admins: see any user’s inbox
- Roll out without interrupting sending

## Server Changes
1) `/api/web/inbox` role handling (server/routes.ts:4955–5030)
- Allow `?userId=...` for supervisors in addition to admins:
  - Reject `?userId` when role NOT in `['admin','supervisor']` (403).
  - `targetUserId = (['admin','supervisor'].includes(req.user.role) && req.query.userId) ? String(req.query.userId) : req.user.userId`.
- If role is `supervisor` and `userId` is provided, enforce group membership:
  - Load supervisor profile; ensure `targetUserId` user has the same `groupId`; otherwise 403.

2) Inbox fallback (ownership gaps)
- Extend `storage.getIncomingMessagesByUserId(userId, limit)` to include `incoming_messages.user_id IS NULL` messages for the acting user via `client_profiles`:
  - `receiver = ANY(assigned_phone_numbers)` OR `LOWER(business) = LOWER(business_name)`
- Keep `ORDER BY timestamp DESC`, respect `limit`, and filter `is_deleted=false`.
- Gate with `INBOX_FALLBACK=true` env to allow enable/disable quickly.

## Front-End Alignment
- Inbox.tsx already passes `?userId` for admin/supervisor when acting on a selected client (`isSupervisor` supported at line 70–72). No changes required.
- On error, display toast; keep retrieve action.

## Observability & Safety
- Add debug logs behind `LOG_LEVEL=debug` in `/api/web/inbox` (userId, role, result count).
- No schema changes; uses existing indices `incoming_user_id_idx`, `incoming_receiver_idx`.
- Zero-downtime deploy via `pm2 reload ibiki-sms --update-env`.

## Rollout Steps
- Implement code changes.
- Set `INBOX_FALLBACK=true` in env.
- Build and `pm2 reload` (fork mode) to avoid downtime; sending continues.
- Validate:
  - As admin: `/api/web/inbox?userId=<any user>` returns items
  - As supervisor: `/api/web/inbox?userId=<group user>` returns items; non-group returns 403
  - As user: `/api/web/inbox` returns items

## Contingency
- If unexpected effects, set `INBOX_FALLBACK=false` and `pm2 reload` to revert to strict ownership.
- Plan a follow-up maintenance job to attribute `incoming_messages.user_id` based on `client_profiles` to eliminate fallback over time.