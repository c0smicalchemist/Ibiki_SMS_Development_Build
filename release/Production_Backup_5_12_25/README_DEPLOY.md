# Ibiki SMS Deployment Package

## Contents
- bundle/index.js
- bundle/public/*
- deploy/setup_server.sh
- .env.production.example

## Requirements
- Node.js 20+
- PostgreSQL 14+
- PM2 (optional)

## Setup
1. Copy this package to the target server, e.g. `/opt/ibiki-sms`.
2. Create `.env.production` in the root based on `.env.production.example`.
3. Install dependencies for the first build only:
   - `npm install` (not strictly required to run the bundled server)
4. Start the server:
   - `NODE_ENV=production PORT=5000 node bundle/index.js`
5. Optional: PM2
   - `pm2 start bundle/index.js --name ibiki-sms --update-env`

## Notes
- `bundle/index.js` serves API and static assets under `bundle/public`.
- Ensure `DATABASE_URL` points to a reachable PostgreSQL instance on the new server.
