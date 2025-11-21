# Ibiki_SMS_Development_Build: Copilot Instructions

## Project Overview
This is a professional SMS API middleware platform for secure passthrough to ExtremeSMS. It manages pricing, credits, and usage tracking, with multilingual support (English/Chinese). The main goal is to hide ExtremeSMS credentials from clients while providing robust account and message management.

## Architecture & Key Components
- **client/**: React frontend (TypeScript, Vite, Tailwind). Main entry: `src/App.tsx`. UI components in `src/components/` and `src/components/ui/`.
- **server/**: Node.js 20 backend (Express). Entry: `server/index.ts`. API routes in `server/routes.ts`. Data storage in `server/storage.ts`.
- **shared/schema.ts**: Data models shared between client and server.
- **migrations/**: SQL migration scripts for database schema.
- **deploy.sh, production-deploy.sh**: Deployment scripts (see also `DEPLOYMENT_CHECKLIST.md`).

## Developer Workflows
- **Build/Run (Dev):**
  - Frontend: `cd client; npm install; npm run dev`
  - Backend: `cd server; npm install; npm run dev` (or use `ecosystem.config.js` for PM2)
- **Deployment:**
  - Use `deploy.sh` for one-click deployment. Make executable: `chmod +x deploy.sh; ./deploy.sh`
  - See `DEPLOYMENT_CHECKLIST.md` and `PRODUCTION_DEPLOYMENT_GUIDE.md` for full steps.
- **Environment:**
  - Copy `.env.example` to `.env` and fill in credentials and pricing config.

## API Endpoints
- `POST /api/v2/sms/sendsingle` — Send single SMS
- `POST /api/v2/sms/sendbulk` — Send bulk SMS (same content)
- `POST /api/v2/sms/sendbulkmulti` — Send bulk SMS (different content)
- `GET /api/v2/sms/status/{messageId}` — Check message status
- `GET /api/v2/account/balance` — Get account balance

## Project-Specific Patterns & Conventions
- **Multilingual UI:** Use `contexts/LanguageContext.tsx` and `lib/i18n.ts` for language switching.
- **Theme Support:** Managed via `contexts/ThemeContext.tsx` and `components/ThemeToggle.tsx`.
- **Pricing Logic:** Controlled via environment variables (`DEFAULT_EXTREME_COST`, `DEFAULT_CLIENT_RATE`).
- **API Key Management:** See `components/ApiKeyDialog.tsx` and `components/ApiKeysManagement.tsx`.
- **Usage Tracking:** Handled in backend, with client-side display in dashboard components.

## Integration Points
- **ExtremeSMS:** All SMS operations proxy through backend, never expose credentials to client.
- **PM2:** Use `ecosystem.config.js` for process management in production.
- **Drizzle ORM:** See `drizzle.config.ts` for database integration.

## Examples & References
- For UI/feature examples, see `client/src/components/examples/`.
- For API usage, see code snippets in `README.md` and `testing/test-api.js`.

---
**If any section is unclear or missing, please specify what needs improvement or additional detail.**
