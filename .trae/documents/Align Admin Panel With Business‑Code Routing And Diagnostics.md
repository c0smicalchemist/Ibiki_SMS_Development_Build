## Observations
- Admin panel text and diagnostics still emphasize receiver/assigned numbers, but routing now prioritizes Business name (IBS code).
- Webhook status shows modem/port and payload, but UI does not surface the business code or the decision path used.

## UI Updates (Admin)
1. Replace copy under “Automatic Routing” to state primary routing by Business (IBS code), with fallbacks: conversation → assigned numbers.
2. Update the “Expected Payload” sample to mark `business` as required/preferred and include exact field list used.
3. Webhook Diagnostics form:
   - Add a “Business (IBS code)” field; make Receiver optional.
   - Prefill Business when an Admin selects a client in the acting‑as dropdown.
   - Submit to existing admin webhook test endpoint with `{ business, from, receiver?, message?, messageId? }`.
4. Show Routing Decision:
   - In the last event card, display `Business`, `Routed User`, `Decision Path` (business/conversation/number), and modem/port.
   - Add a compact timeline of recent events with business and routed client.
5. Add “Business Mapping” table under Configuration:
   - List clients with `businessName`, allow edit, and quick copy of IBS code.
   - Validate uniqueness (case‑insensitive) and warn on duplicates.

## Server Enhancements (Diagnostics)
1. Extend `/api/admin/webhook/status` to include `decisionPath` and `business` from last event.
2. Ensure `/api/admin/webhook/test` accepts `business` and routes using the same logic as real webhook.
3. Add `/api/admin/business-mapping` endpoint to list/edit `client_profiles.business_name` (admin‑only).

## Contacts & CSV
1. Admin Direct Mode and client UI CSV import:
   - Require/select Business; default to the selected client’s `businessName`.
   - Persist business with each contact; exports include business for Extreme sync.
2. Auto‑capture contacts on send/webhook uses client `businessName` when `payload.business` is missing.

## Aggregator Model Support
1. Document aggregator endpoints for clients:
   - Send: `POST /api/sms/send` (server infers business by session client; optional `business` to override in multi‑tenant admin flows).
   - Inbox/History: `GET /api/client/inbox` and `GET /api/client/messages?limit=N` scoped to the client.
2. Ensure webhook routing works identically; clients pull their inbox via API.

## Acceptance Tests
1. Admin edits a client’s IBS code; webhook test with that code routes to that client.
2. Real webhook posts with `business: IBS_2`; last event shows decisionPath=business and modem/port; admin can reply; message lands in correct history.
3. CSV import in Admin Direct Mode with Business set; contacts tagged and exported include business.
4. Aggregator client sends via API; inbound replies route to their inbox.

## Deployment
1. Update admin UI components and copy.
2. Extend admin diagnostics/status endpoints as above.
3. Run safe deploy and verify:
   - Health OK
   - Webhook status shows business and decision path
   - Diagnostics form accepts IBS and routes correctly.

## Request for Confirmation
- Confirm we should proceed with these admin UI changes and diagnostic endpoint additions; I will implement and deploy, then run the acceptance tests above and share results.