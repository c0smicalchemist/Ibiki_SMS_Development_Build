## Backups (Local + Git)
- Local snapshot:
  - Create a tarball including current `dist/`, `server/`, `client/`, `shared/`, `.env`, and `package-lock.json` → `release/ibiki-snapshot-<timestamp>.tar.gz`.
  - Record DB reachability: run `/api/health/detailed` and `/api/admin/db/status` → store outputs as `backup_status.txt`.
- Git snapshot:
  - Commit current workspace state: "Snapshot: pre-phone-normalization <date>".
  - Push to `Ibiki_Production_Final` and optionally create a backup branch `backup/pre-normalization-<date>`.

## ExtremeSMS Compatibility
- Target format for `payload.recipient` is E.164-like (leading "+" with country code). ExtremeSMS endpoints used:
  - `POST https://extremesms.net/api/v2/sms/sendsingle` (payload `{ recipient, message, usemodem?, port? }`).
- Normalize inputs to E.164 consistently before calling ExtremeSMS.

## Implementation
### Shared Utility (`shared/phone.ts`)
- `normalizePhone(input: string, defaultDial: string): string | null`
  - Strip non-digits except a single leading "+".
  - Coerce `00` or `011` prefixes to "+".
  - If starts with "+" → keep as `+digits`.
  - Else, if digits start with default country code → prepend "+".
  - Else, if digits length is 10 (typical US) or within 6–15 → prepend `defaultDial`.
  - Validate 8–15 total digits; return `null` if invalid.
- `normalizeMany(inputs: string[], defaultDial: string): { ok: string[]; invalid: string[] }` (dedupe, filter invalids).

### Server Route Updates (`server/routes.ts`)
- `POST /api/web/sms/send-single` (3329):
  - Accept optional `defaultDial` from client; fallback `+1`.
  - Normalize `req.body.to` with `normalizePhone` → use in `payload.recipient`.
- `POST /api/web/sms/send-bulk` (3405):
  - Normalize `req.body.recipients[]` via `normalizeMany`.
  - Send only normalized recipients; include `{ normalizedCount, invalidCount, invalidSamples }` in response.
- `POST /api/web/sms/send-bulk-multi` (3482):
  - Normalize each `messages[i].to`; drop invalid entries and report invalids.
- Logging: persist both original and normalized values in `message_logs`.

### Client Adjustments (`client/src/pages/SendSMS.tsx`)
- Include `defaultDial` (selected country dial) in payload for Single/Bulk/Bulk Multi/Bulk CSV.
- Keep placeholders without "+" and hints minimal; rely on server normalization.

## Testing
- Functional tests via curl:
  - Single: send `to` as `+113468719294`, `113468719294`, `13468719294`, `3468719294`, `0013468719294` with `defaultDial=+1`; expect normalized `+13468719294`.
  - Bulk: mixed inputs → validate `{ normalizedCount, invalidCount }` and provider success.
  - Bulk Multi: validate per-item normalization and invalid filtering.
- Provider test: call the ExtremeSMS sendsingle flow through the app (admin key) to verify acceptance of normalized recipient.

## Deployment & Rollback
- Build and restart after changes.
- If issues arise, rollback using the snapshot tarball or backup branch.

Confirm and I’ll execute the backup, implement normalization, test with ExtremeSMS, and deploy.