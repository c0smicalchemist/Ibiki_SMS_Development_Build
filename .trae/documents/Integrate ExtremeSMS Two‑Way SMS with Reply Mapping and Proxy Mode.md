## Overview

* Implement full two‑way SMS with ExtremeSMS where initial sends omit `usedmodem` and `port`, and replies include the `usedmodem`/`port` values provided by Extreme’s incoming webhook.

* Auto‑capture recipients into contacts on first send or first inbound message.

* Strengthen proxy mode so clients only interact with Ibiki endpoints and branding.

* Add observable health and verification tools so you can confirm webhook routing and reply readiness.

## Server API Changes

1. Add `POST /api/webhook/extreme` (or reuse existing webhook endpoint) to accept Extreme’s inbound webhook JSON. Persist inbound messages and capture `usedmodem` and `port` from the payload.
2. Add `POST /api/sms/send` for client‑initiated sends (initial messages). Forward to Extreme `sendsingle` with `{ recipient, message }` and omit `usedmodem`/`port`.
3. Add `POST /api/sms/reply` for replies. Server looks up the last inbound message context and forwards to Extreme with `{ recipient, message, usemodem, port }` (mapped from the inbound webhook).
4. Add `GET /api/admin/webhook/events` and `GET /api/admin/webhook/last` to surface recent inbound events for verification.

## Database Changes

1. Extend `incoming_messages` to store modem context:

   * New columns: `ext_used_modem` (text), `ext_port` (text).

   * Optional: `ext_payload` (jsonb) to retain raw webhook payload for debugging.
2. Auto‑capture contacts:

   * On `send` and `webhook` ingest, if phone not in `contacts` for that user, create a contact with `phoneNumber`, and set `business` from client profile if available.
3. Indexes:

   * Index `incoming_messages.ext_port` and `ext_used_modem` to accelerate lookups for reply mapping.

## Webhook Handling & Routing

1. Authentication: Verify webhook origin (e.g., shared secret header) if Extreme provides it, else rate‑limit and log.
2. Routing to the right user:

   * Primary: route by `receiver` (assigned number) if present.

   * Fallback: route by `ext_port`/`ext_used_modem` using a per‑client mapping table (lightweight table `extreme_modem_routes(user_id, modem, port, assigned_numbers[])`).
3. Persist:

   * Save inbound into `incoming_messages` with `userId`, `from`, `receiver`, `message`, `ext_used_modem`, `ext_port`, and `messageId`.

## Reply Flow

1. Inbox reply action calls `POST /api/sms/reply` with `inboundMessageId` or `conversationKey`.
2. Server fetches the modem/port from the inbound message record and sends reply via Extreme:

   * `curl --location 'https://extremesms.net/api/v2/sms/sendsingle' --header 'Authorization: Bearer {EXTREME_API_KEY}' --header 'Content-Type: application/json' --data '{"recipient":"+123...","message":"...","usemodem":"<ext_used_modem>","port":"<ext_port>"}'`.
3. Log replies in `message_logs` with context so audits show initial vs reply.

## Client UI Updates

1. Send SMS page:

   * No UI changes for initial send; server omits `usemodem`/`port` automatically.
2. Inbox:

   * Reply button uses new `/api/sms/reply` endpoint; UI does not expose modem/port—kept internal.
3. Admin → Configuration:

   * Add a table to view modem/port mappings detected from recent webhooks; allow optional manual overrides (edge cases).

## Observability & Verification

1. Admin Webhook Status card:

   * Show last event time, last `ext_used_modem`/`ext_port`, and routed user.
2. Add “Test Reply Readiness” button:

   * Picks the last inbound message for the selected user and simulates a reply (dry‑run mode that does not hit Extreme but passes validation).
3. Add `GET /api/admin/webhook/events?limit=50` for quick console checks.
4. Logs:

   * Ensure no API keys are logged; mask sensitive fields.

## Proxy Mode Hardening

1. Ensure all client actions call Ibiki APIs only; never expose Extreme endpoints or keys client‑side.
2. Keep branding Ibiki; remove any Extreme mentions from UI.
3. Rate limit and error handling so failures from Extreme are normalized to Ibiki error responses.

## Security & Config

1. Use `EXTREME_API_KEY` from server environment/system config; never store raw keys in DB records.
2. If Extreme provides webhook signature, verify it; if not, use IP allow‑list or token header and rate‑limit.
3. Store `WEBHOOK_SECRET` already used by the app for verification if available.

## Rollout Steps

1. Apply DB migration for `incoming_messages` new columns and optional `extreme_modem_routes` table.
2. Implement server routes and wiring (send, reply, webhook ingest, admin events).
3. Update Inbox reply to use `/api/sms/reply`.
4. Deploy and run safe‑deploy scripts.
5. Verify: trigger an inbound webhook (real or simulated), ensure:

   * Number auto‑captured into contacts.

   * Inbox shows message.

   * Reply sends with `usemodem` and `port` included and succeeds.
6. Confirm Admin pages show modem/port context and last events.

## Data Migration & Backward Compatibility

* Existing inbox entries remain valid; new fields are nullable and filled on new webhook events.

* Reply flow falls back to default send if modem/port missing (with warning) to avoid blocking.

## Success Criteria

* Initial sends work without modem/port.

* Inbound webhook captured with modem/port.

* Replies include modem/port and succeed.

* Contacts are auto‑captured.

* Admin verification clearly shows webhook health and routing.

* No Extreme identifiers visible to clients.

## Request for Confirmation

* Confirm this plan and I’ll implement the API changes, DB migration, UI wiring, and verification tools, then deploy and validate end‑to‑end.

