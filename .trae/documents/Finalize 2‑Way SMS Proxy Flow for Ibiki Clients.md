## Goals
- Enable clients to reply without handling modem/port mapping via a helper endpoint.
- Add optional push‑webhook from Ibiki to client systems for inbound messages.
- Allow clients to use either polling, push, or both via an admin toggle.
- Align docs and UI with new capabilities.

## Server Endpoints (Public API)
- `POST /api/v2/sms/reply` (Bearer)
  - Input: `{ to: string, message: string }`
  - Logic: find last inbound for `to` (acting client); inject `usemodem`/`port`; forward to Extreme v2; log and return JSON.
- `POST /api/v2/webhooks/register` (Bearer)
  - Input: `{ url: string, secret?: string }`
  - Persist per client: webhook URL + shared secret for signing; validate HTTPS.
- `GET /api/v2/webhooks/status` (Bearer)
  - Returns current webhook URL and mode for the acting client.

## Server Endpoints (Admin)
- `POST /api/admin/clients/:id/delivery-mode` (JWT, admin)
  - Body: `{ mode: 'poll' | 'push' | 'both' }`
  - Persists to client profile.
- `POST /api/admin/clients/:id/webhook` (JWT, admin)
  - Body: `{ url: string, secret?: string }` to set the client webhook.

## Data Model
- Extend `client_profiles` with:
  - `deliveryMode` (text; default 'poll')
  - `webhookUrl` (text; nullable)
  - `webhookSecret` (text; nullable)
- Migration scripts ensure safe adds with defaults.

## Inbound Dispatch Logic
- After ingesting Extreme webhook and assigning `userId`:
  - If client `deliveryMode` is 'push' or 'both' and `webhookUrl` present:
    - POST to client webhook with JSON payload mirroring `incoming_messages` fields.
    - Include headers: `X-Ibiki-Signature: HMAC_SHA256(body, webhookSecret)` if secret present.
    - Retry policy: 3 attempts with exponential backoff; log failures.

## Web Dashboard UI (Admin)
- Client Management table:
  - Add a toggle: “Delivery Mode” with options Poll / Push / Both.
  - Add inputs for “Webhook URL” and “Webhook Secret”.
  - Show status badge (Configured / Not set).

## API Docs Updates
- Authentication heading fixed (done).
- Add section “Two‑Way SMS”: 
  - Option A Polling: `GET /api/v2/sms/inbox` + reply via `POST /api/v2/sms/reply`.
  - Option B Push: register webhook and receive signed POSTs; reply via `POST /api/v2/sms/reply` or `POST /api/v2/sms/sendsingle` with modem/port.
- Add examples for `POST /api/v2/webhooks/register` and signed verification.

## Security & Observability
- Validate webhook URLs (HTTPS, hostname length, scheme).
- HMAC signatures for push; rotate secrets via admin.
- Structured logs for inbound processing and push deliveries.

## Rollout Plan
1) Add fields to `client_profiles` with migration.
2) Implement endpoints and push dispatcher.
3) Update admin UI toggles and inputs.
4) Update API docs with new endpoints and flows.
5) End‑to‑end tests: webhook ingest → push dispatch → client reply via helper.

## Answer: How clients get and perform 2‑way SMS
- Today (proxy mode): Ibiki ingests Extreme webhook, routes by business, stores, and exposes inbox via UI (`/api/web/inbox`) and API (`/api/v2/sms/inbox`).
- Replies:
  - Web: `/api/web/inbox/reply` auto‑maps modem/port from last inbound.
  - API: Poll inbox, then reply via `sendsingle` (include modem/port) or the new `reply` helper (to be added).
- With push enabled: Ibiki will POST inbound to client’s webhook; they can still poll or reply via API; mode can be Poll, Push, or Both per client.

## Confirmation
- If approved, I’ll implement the reply helper, push webhook registration, admin toggles, migrations, and documentation in one change set, then deploy and verify JSON responses for all endpoints.