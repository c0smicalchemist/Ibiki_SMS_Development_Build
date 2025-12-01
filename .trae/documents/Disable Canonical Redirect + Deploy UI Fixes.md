## Objectives
- Create local and git backups before any change
- Disable canonical redirect and deploy UI fixes
- Verify admin and webhook flows end‑to‑end; provide rollback

## Backups
- Local (repository)
  - Create a backup tag from current HEAD: `git tag pre-fix-$(date +%Y%m%d-%H%M)` and `git push --tags`
  - Create a backup branch from production: `git checkout -B backup/$(date +%Y%m%d-%H%M) Ibiki_Production_Final && git push -u origin backup/$(date +%Y%m%d-%H%M)`
  - Copy Nginx config snapshot in repo: duplicate `ops/nginx/ibiki-sms.conf` to `ops/nginx/ibiki-sms.conf.bak-<timestamp>`
- Server
  - App snapshot: `sudo tar -czf /opt/ibiki-sms-backup-$(date +%Y%m%d-%H%M).tar.gz -C /opt ibiki-sms`
  - Nginx snapshot: `sudo cp /etc/nginx/sites-available/ibiki-sms.conf /etc/nginx/sites-available/ibiki-sms.conf.bak-$(date +%Y%m%d-%H%M)`
  - Record current commit: `cd /opt/ibiki-sms && git rev-parse HEAD > /opt/ibiki-sms-backup-commit.txt`

## Changes
- Nginx
  - Update HTTP redirect to preserve host: `return 301 https://$host$request_uri;`
  - Add `add_header Cache-Control "no-store, must-revalidate";` and `expires -1;` in `location /`
- Client/UI
  - Validate `client/src/lib/i18n.ts` (already clean and includes supervisor keys at client/src/lib/i18n.ts:152–154)
  - Add missing keys used by pages: `admin.config.error.saveFailed`, `admin.config.error.connectionFailed`, `admin.config.error.updatePhonesFailed`, `messageHistory.error.fetchFailed` (+ optional status keys)
  - Confirm role‑aware titles and back routes in AdminDashboard and MessageHistory are present
- Server
  - No change to webhook routes; confirm POST `/api/webhook/extreme-sms` exists at server/routes.ts:1957–2084

## Deployment
- App build/restart
  - `cd /opt/ibiki-sms && git fetch && git checkout -B Ibiki_Production_Final origin/Ibiki_Production_Final`
  - `npm ci && npm run build`
  - `pm2 restart ibiki-sms --update-env`
- Apply Nginx
  - Edit `/etc/nginx/sites-available/ibiki-sms.conf` as above
  - `sudo nginx -t && sudo systemctl reload nginx`

## Verification
- Redirects
  - `curl -I http://<host>/admin` → `Location: https://<host>/admin`
- UI
  - Open `https://<host>/admin` and `https://<host>/adminsup`
  - Supervisor sees “Supervisor Dashboard”; back returns to `/adminsup`
  - Admin sees “Admin Dashboard”; back returns to `/admin`
- Webhook
  - POST sample to `/api/webhook/extreme-sms`; check `GET /api/admin/webhook/status` (server/routes.ts:1718–1733)
- Health
  - `curl -s https://<host>/api/test` returns OK

## Rollback
- Restore Nginx: copy back `.bak` file and reload Nginx
- Restore app: `git checkout <backup-tag-or-commit> && npm ci && npm run build && pm2 restart ibiki-sms`

## Notes
- GET to `/api/webhook/extreme-sms` returns 404 by design; use POST
- i18n also includes login strings so the login page reads “Log in to Ibiki SMS; Access your dashboard and APIs” (client/src/lib/i18n.ts:169–176)