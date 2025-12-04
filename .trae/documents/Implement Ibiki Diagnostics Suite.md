**Pre-Deployment Backups**

* Git backup (no execution until approved)
  - Create branch: `diagnostics-setup-<YYYYMMDD-HHMM>`
  - Stage current changes: `git add -A`
  - Commit: `git commit -m "chore: add diagnostics suite and UI + fixes"`
  - Push: `git push origin diagnostics-setup-<YYYYMMDD-HHMM>`
* Local backup
  - Create archive: `backup-<YYYYMMDD-HHMM>.zip`
  - Include: `client/`, `server/`, `dist/`, `package*.json`, `.env.production` (without secrets if you prefer), and any scripts

**Diagnostics Suite (Server)**

* Endpoint: `GET /api/admin/diagnostics/run` (admin-only) with `{ dryRun=true }`
* Returns structured report: `{ success, summary, checks: [{ name, status, details, durationMs }] }`
* Checks:
  - Database: connect via `DATABASE_URL`, list key tables, parse host/port/database
  - Localization: report configured locales and default; sample translate keys resolve
  - Webhook routing:
    - Primary: business routing (`IBS_*`)
    - Fallbacks: receiver alias mapping, recent conversation mapping
    - Run 3 synthetic dry-run events and capture routed user
  - Credit deduction: dry-run `deductCreditsAndLog` for admin-direct/supervisor-direct/client-charged scenarios; no DB writes
  - Provider connectivity:
    - ExtremeSMS: balance endpoint
    - OpenRouter/Grok: models + short chat test
  - Message logging: dry-run samples for single/bulk/multi and fetch latest 10 logs
  - Inbox intake: last webhook event timestamp + routed user
  - Environment/assets: bundle name present, static asset 200 OK (no content-length mismatch)
* Add helpers:
  - `deductCreditsAndLogDryRun(...)`
  - Webhook dry-run mode flag
  - Timeouts and error capture per check (e.g., 10s)

**Diagnostics UI (Client)**

* Admin Dashboard card: “Ibiki Diagnostics”
  - Buttons: Run, Export JSON, Copy
  - Tiles: Database, Localization, Webhook (Primary/Fallback), Credits, Provider (ExtremeSMS/OpenRouter), Logging, Inbox, Environment
  - Each tile: pass/fail, short text, “View details” modal
  - Links: Test Grok, Set Webhook URL

**Webhook Primary & Fallback**

* Primary: business name routing (e.g., `IBS_4`)
* Fallbacks: receiver alias mapping (e.g., `+138012` → real MSISDN), recent conversation mapping
* Diagnostics report which strategy routes synthetic events successfully

**Safety**

* Admin-only endpoints; rate limit diagnostics to 1 run / 15s
* Dry-run by default; no persistent writes or credit changes
* Redact secrets from outputs

**Acceptance Criteria**

* Admin can run diagnostics and see pass/fail tiles and details
* DB, locale, webhook, credits, providers, logging, inbox, and environment checks report correctly
* Exportable JSON report
* Git branch and local zip backup created before deployment

**Execution Plan (after approval)**

1. Create git branch and local backup
2. Implement server diagnostics API and dry-run helpers
3. Add Admin UI card with tiles and modals
4. Validate in staging (run diagnostics, verify tiles)
5. Deploy and run diagnostics in production
