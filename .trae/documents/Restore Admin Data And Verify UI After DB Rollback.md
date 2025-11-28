**What We Will Verify**
- Backend auth and admin data flow is healthy and returning clients.
- Frontend Admin Mode selector and Contacts data populate from `/api`.
- Database restore is correct, with table presence and real row counts.

**Backend Endpoints To Check**
- `GET /api/client/profile` should return your user with role `admin` (server/routes.ts:882).
- `GET /api/admin/clients` should return non‑empty `clients` for admin/supervisor (server/routes.ts:1266).
- Frontend queries use these via React Query and `apiRequest` with Bearer token (client/src/lib/queryClient.ts:10, 41–78).

**Database Verification (Corrected SQL)**
- List public tables: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
- Estimated row counts per table: `SELECT schemaname, relname AS table_name, n_live_tup AS row_estimate FROM pg_stat_user_tables ORDER BY relname;`
- Exact counts for key tables (example):
  - `SELECT 'users' AS table, count(*) FROM public.users`
  - `UNION ALL SELECT 'client_profiles', count(*) FROM public.client_profiles`
  - `UNION ALL SELECT 'contacts', count(*) FROM public.contacts`
  - `UNION ALL SELECT 'api_keys', count(*) FROM public.api_keys`
- Why previous SQL failed: Postgres cannot concatenate identifiers into `FROM public."" || table_name || """` in plain SQL. Use catalog views (`pg_stat_user_tables`) for estimates or explicit queries for exact counts.

**API Health Checks (no code changes)**
- Log in and confirm identity: `POST /api/auth/login` → token, then `GET /api/auth/me` with `Authorization: Bearer <token>` should show `role=admin`.
- Admin data: `GET /api/admin/clients` with Bearer should return `{ success: true, clients: [...] }`.
- Profile: `GET /api/client/profile` with Bearer should return `{ success: true, user: { role: 'admin' }, ... }`.

**Frontend Behavior Validation**
- Token propagation: The client attaches `Authorization: Bearer <token>` and also `?token=<jwt>` for `/api/*` (client/src/lib/queryClient.ts:10–39, 41–78). Your Nginx include restores `Authorization` forwarding, which the server accepts (server/routes.ts:17–41).
- Admin Mode selector loads clients from `/api/admin/clients` (client/src/components/ClientSelector.tsx:27). It displays inside Contacts (client/src/pages/Contacts.tsx:376–381) and auto‑selects a client when not in admin mode (ClientSelector.tsx:33–37).
- Contacts page impersonation: When admin and not in admin mode, `selectedClientId` is used as `userId` for group/contact queries (client/src/pages/Contacts.tsx:95, 100–106, 118–126).

**Refresh & Edge Cases**
- Clear stale token after server restart if needed: in browser devtools, `localStorage.removeItem('token')`, re‑login, then reload `/admin` and `/contacts`.
- Expected UI: Admin tabs populate; ClientSelector shows clients (credits/email), and contacts/groups load for the selected client.

**If Clients Still Empty**
- Confirm `/api/admin/clients` directly; if 401/403, token is invalid → re‑login. If 200 with empty list, DB lacks client roles.
- Server logs: look for `"Admin clients fetch error"` (server/routes.ts:1306) or role gate failures in `requireRole(["admin","supervisor"])` (server/routes.ts:52–59, 66).
- Nginx: ensure the `include /etc/nginx/conf.d/ibiki-headers.conf;` resides inside the `location /api/ { ... }` block.

**Success Criteria**
- `/api/admin/clients` returns >0 clients and Admin Mode selector renders them.
- `/api/client/profile` shows `role=admin`.
- Contacts page fetches groups/contacts with or without `userId` according to Admin Mode.

Approve and I will run the health checks, confirm endpoint outputs, and, if any gaps remain, adjust configuration or client logic accordingly.