## Findings
- Admin dashboard page exists with rich tooling, but critical workflows depend on having client accounts; your UI shows “No clients available”, so most actions cannot be exercised.
- Existing server endpoints cover nearly all admin operations already:
  - Clients list and management: `server/routes.ts:1266` (`GET /api/admin/clients`), updates at `routes.ts:2264` (phones), `routes.ts:2300` (rate limit), `routes.ts:2332` (business), role/group at `routes.ts:1323`, `routes.ts:1338`.
  - Credits: `routes.ts:2191` (`POST /api/admin/adjust-credits`).
  - Webhook diagnostics and status: `routes.ts:1552–1663`.
  - Stats/activity/logs: `routes.ts:1221` (stats), `routes.ts:1239` (recent activity), `routes.ts:2129` (error logs), `routes.ts:1312` (supervisor logs).
- Client-side admin page already wires these calls (`client/src/pages/AdminDashboard.tsx`). Supervisor audit table exists but is not surfaced.

## Goal
Restore practical admin workflows directly from the dashboard:
- Create clients from admin and immediately configure credits, numbers, business name.
- Impersonate a client for address book and inbox management.
- Surface supervisor/audit logs in the dashboard.
- Optional: add quick view of webhook events.

## Implementation Plan
### 1) Add “Create Client” dialog to AdminDashboard
- New component `client/src/components/CreateClientDialog.tsx` with form: `name`, `email`, `password` (auto-generate if blank).
- On submit:
  - Call `POST /api/auth/signup` to create user and profile (`server/routes.ts:599–649`).
  - Then chain admin updates: set initial credits via `POST /api/admin/adjust-credits`, assign phone numbers via `POST /api/admin/update-phone-numbers`, set business via `POST /api/admin/update-business-name`.
- After success: invalidate `/api/admin/clients` and show toast.
- Add a primary “New Client” button above the Clients table that opens this dialog.

### 2) Add “Impersonate Client” quick action
- In Clients table row, add a button `Impersonate` that:
  - Writes `localStorage.selectedClientId = <client.id>` and `localStorage.isAdminMode = 'false'`.
  - Navigates to `/contacts` where `ClientSelector` already reads these values (`client/src/components/ClientSelector.tsx`).
- Provide a small helper tip near the selector when no clients exist.

### 3) Surface Supervisor/Audit Logs
- Add a new tab “Audit” in `AdminDashboard.tsx`.
- Render the existing `SupervisorLogsTable()` component (already implemented at `client/src/pages/AdminDashboard.tsx:1288–1327`).
- Fetches `/api/admin/supervisor-logs` (`server/routes.ts:1312`).

### 4) Optional: Webhook Events Viewer
- Add a compact table in the “Webhook” tab showing last N events via `GET /api/admin/webhook/events` (`server/routes.ts:2029`).
- Columns: time, receiver, routed user, messageId.

### 5) UX polish and guardrails
- Respect role gating already present: supervisors can view clients but inputs for rate-limit & delivery-mode remain disabled (`client/src/pages/AdminDashboard.tsx:619, 687`).
- Add inline empty states and callouts guiding the admin to create the first client when the list is empty.

### 6) Verification
- Run locally and on your deployment:
  - Create a test client; confirm it appears under “Client Management”.
  - Adjust credits; confirm new balance reflects immediately.
  - Assign phone numbers and business; perform webhook test and verify routing.
  - Use “Impersonate” to manage contacts; export/import CSV works.
  - Confirm Audit tab shows supervisor actions.

## Scope of Changes
- New UI component: `CreateClientDialog.tsx`.
- Edits to `client/src/pages/AdminDashboard.tsx` to add the dialog trigger, impersonation action, Audit tab, and optional events viewer.
- No server changes required; reuse existing endpoints.

## Request
Confirm this plan to proceed with implementation. I’ll make the UI additions, wire them to the existing APIs, and verify end-to-end so your admin dashboard regains full functionality.