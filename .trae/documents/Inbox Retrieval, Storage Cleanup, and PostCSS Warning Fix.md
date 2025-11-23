## Overview
- Clean duplicate methods in `server/storage.ts` to a single DB-backed implementation.
- Fix PostCSS warning by adjusting `postcss.config.js` to set `from: undefined`.
- Add a "Retrieve Inbox" button to Inbox for admin and normal users; backend endpoint pulls ExtremeSMS queued messages and processes them through the existing webhook routing logic.
- After implementation, run build and tests, then commit changes.

## Storage Cleanup
- Remove duplicate method definitions and keep one authoritative implementation for:
  - `findClientByRecipient` (server/storage.ts:462, 1194)
  - `hasExampleData` (server/storage.ts:589, 595)
  - `deleteExampleData` (server/storage.ts:571, 601)
  - `createIncomingMessage` (server/storage.ts:628, 1227)
  - `getIncomingMessagesByUserId` (server/storage.ts:649, 1232)
  - `getAllIncomingMessages` (server/storage.ts:657, 1244)
  - `markIncomingMessageAsRead` (server/storage.ts:664, 1255)
  - `markConversationAsRead` (server/storage.ts:672, 1261)
  - `getConversationHistory` (server/storage.ts:681, 1269)
- Ensure all server routes import and use the unified versions; run TypeScript build to validate.

## PostCSS Warning Fix
- Update `postcss.config.js` to explicitly include `from: undefined`:
  - Export: `{ from: undefined, plugins: { tailwindcss: {}, autoprefixer: {} } }`
- Verify Vite build no longer shows the `postcss.parse` `from` warning.

## Webhook Retrieval Backend
- Refactor webhook logic in `server/routes.ts` into a reusable function:
  - Extract the routing and persistence from `POST /webhook/incoming-sms` (server/routes.ts:731) into `processIncomingSmsPayload(payload)`.
  - Use it in both the webhook route and the new retrieval route.
- Implement `POST /api/web/inbox/retrieve` (JWT auth):
  - Normal users: retrieve and process queued messages relevant to their account.
  - Admins: optionally accept `userId` to act on behalf of a client, otherwise process globally.
  - Retrieve messages from ExtremeSMS queue via `EXTREMESMS_BASE_URL` and API key (existing pattern used for send/status calls).
  - For each payload, call `processIncomingSmsPayload(payload)`; idempotency based on `messageId`.
  - Return `{ success: true, processedCount }`.
- Store diagnostics (last retrieval time and count) via `system_config` similar to `last_webhook_event_at`.

## Inbox UI: Retrieve Button
- Add a new button labeled `Retrieve Inbox` on `client/src/pages/Inbox.tsx` header next to existing refresh:
  - Use `useMutation` to call `POST /api/web/inbox/retrieve`.
  - Admin mode: include `userId` when acting on behalf of a selected client; normal users call without `userId`.
  - On success: invalidate `['/api/web/inbox']` and show a success toast.
  - Disable button while mutation is pending.
- Keep the existing `Refresh` behavior for cache refetch; the new button actively pulls and processes queued messages.

## Role Handling
- Continue using existing auth/role checks:
  - `authenticateToken` populates `{ userId, role }`.
  - Admin-only actions permitted with `userId` parameter; normal users restricted to self.

## Verification
- Run `npm ci` and `npm run build`; ensure no TypeScript errors and the PostCSS warning is gone.
- Hit `POST /api/admin/webhook/test` to simulate incoming message, verify it appears in Inbox.
- Test `POST /api/web/inbox/retrieve` for normal and admin modes; confirm UI updates.
- Check that duplicate method warnings in `server/storage.ts` no longer appear in build output.

## Commit
- Stage modified files:
  - `server/storage.ts`
  - `server/routes.ts`
  - `postcss.config.js`
  - `client/src/pages/Inbox.tsx`
  - Any helper module created for `processIncomingSmsPayload`
- Commit with message: `feat(inbox): add Retrieve Inbox; refactor webhook processing; fix PostCSS warning; cleanup storage duplicates`.

## Notes
- Webhook URL remains `http://151.243.109.79/webhook/incoming-sms`.
- Sample payload supported:
  - Fields: `from`, `firstname`, `lastname`, `business`, `message`, `status`, `matchedBlockWord`, `receiver`, `timestamp`, `messageId`.
- If ExtremeSMS queue API shape differs, we’ll abstract retrieval behind a provider client and adjust fetch URL and auth accordingly.