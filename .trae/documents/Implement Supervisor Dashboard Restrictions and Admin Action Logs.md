## Corrections & Scope
- Supervisors see only two tabs: `Clients` and `Logs`
- Both tabs are strictly scoped to entities sharing the supervisor’s `groupId`
- Supervisors do not see `Configuration`, `Webhook`, `API Testing`, or `Monitoring`
- Admins retain full access plus a new `Action Log` tab

## Supervisor Experience
- `Clients` tab: list and basic info for users within the same `groupId`
  - Hide admin-only columns: `Rate limit`, `Delivery mode`, `Webhook`
  - Allow read-only view of credits and contact details
- `Logs` tab: supervisor can view only logs for supervisors and users within the same `groupId`
  - Read-only; includes error entries
- `Supervisor Direct Mode` across Send SMS, Inbox, Contacts, Message History:
  - Label and banner updated
  - Behavior: direct mode → zero client charge, audit log tagged as `supervisor`
  - Acting-as-client (same `groupId`) → charged to that client; group check enforced server-side

## Server Enforcement & Endpoints
- Group scoping for supervisors across endpoints:
  - `/api/admin/clients` (already partially filters by `groupId`); confirm and apply for other endpoints used by Clients tab
  - New logs endpoint for supervisors:
    - `GET /api/supervisor/logs?limit=...` → returns action logs only for `groupId`
- Send endpoints support `supervisorDirect` flag and group enforcement when acting-as-client
- Admin Action Logs (admin-only):
  - `GET /api/admin/action-logs?type=supervisor|user&limit=...` (all groups)
  - `GET /api/admin/action-logs/export?type=supervisor|user&since=...` (all groups)
- Retention job: auto-delete action logs older than 30 days (scheduled daily + on startup)

## Actions to Log (examples)
- Supervisor actions (group-scoped):
  - `send_direct_supervisor`
  - `send_on_behalf_supervisor`
  - `inbox_delete`, `inbox_restore`, `inbox_purge_deleted`
  - `contacts_import_csv`, `contacts_export_csv`, `contacts_add`, `contacts_update`, `contacts_delete`
  - `view_clients_group`, `view_logs_group`
- User actions (group-scoped under supervisor view):
  - `send_single`, `send_bulk`, `send_bulk_multi`
  - `inbox_delete`, `inbox_restore`
  - `contacts_import_csv`, `contacts_export_csv`, `contacts_add`
- Error logging: append `error` field to action logs for failures in all above operations

## UI Changes
- AdminDashboard:
  - Role-based tabs:
    - Admin: `Clients`, `Configuration`, `Webhook`, `API Testing`, `Monitoring`, `Action Log`
    - Supervisor: `Clients`, `Logs`
- Supervisor Logs tab:
  - Two subviews: `Supervisor` and `User`
  - Export button (downloads text)
- ClientSelector & relevant pages:
  - Banner shows `Supervisor Direct Mode` when role is supervisor

## i18n
- Add keys for `Supervisor Direct Mode`, `Logs`, export button, and related messages (EN/ZN)

## Implementation Steps
1. Update role-based tab rendering to show only `Clients` and `Logs` to supervisors
2. Enforce group scoping for supervisors on `clients` and new `logs` endpoint
3. Extend send endpoints with `supervisorDirect` and group checks
4. Implement admin action logs fetch/export; supervisor group-scoped logs fetch
5. Schedule 30-day retention cleanup
6. Add i18n keys and labels
7. Deploy and verify with supervisor and admin accounts

## Verification
- Supervisor account in group `G1` sees only `Clients` and `Logs` tabs with `G1` entities
- Supervisor Direct Mode sends create audit logs without charging clients
- Acting-as-client sends charge selected client (same `groupId`), otherwise rejected
- Admin sees Action Log tab listing supervisor and user logs across groups; export works
- Retention job removes logs older than 30 days.

Confirm and I will implement and deploy.