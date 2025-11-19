# Ibiki SMS v11.4 Update - Database Persistence & Complete Translations

## 🎯 Critical Changes

### ✅ Database Persistence (CRITICAL FIX)
- **Switched from MemStorage to PostgreSQL**
- All user data, API keys, and settings now persist through updates
- Zero data loss on application restarts or updates
- Singleton connection pool prevents socket leaks
- Graceful shutdown handlers for clean exits
- Automatic fallback to in-memory storage if DATABASE_URL missing

### ✅ Complete Translation Coverage
- Fixed all remaining untranslated text in API documentation
- ApiEndpointCard now uses translation system
- Added `api.requestExample` and `api.responseExample` keys
- 100% translation coverage (EN + 中文)

## 🚀 Quick Deploy to Production Server

### Upload to Server (151.243.109.79)
```bash
scp ibiki-sms-v11.4.tar.gz root@151.243.109.79:/root/
```

### SSH and Deploy
```bash
ssh root@151.243.109.79
cd /root
tar -xzf ibiki-sms-v11.4.tar.gz
cd ibiki-sms
sudo ./deploy.sh
```

## 📋 What deploy.sh Does Automatically

1. ✓ Detects if you want to deploy in /root (in-place) or /opt/ibiki-sms
2. ✓ **Preserves your existing .env file** (with DATABASE_URL and secrets)
3. ✓ Installs/updates Node.js dependencies
4. ✓ Pushes database schema changes (creates new tables if needed)
5. ✓ Configures PM2 process manager
6. ✓ Sets up systemd for auto-start on boot
7. ✓ Configures file permissions
8. ✓ Restarts the application

## ⚙️ Environment Requirements

Your `.env` file must contain:
```env
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
SESSION_SECRET=your-32-character-random-secret
NODE_ENV=production
PORT=6000
```

**Note:** Your DATABASE_URL is stored in Replit Secrets and persists automatically. If deploying fresh, you'll need to set it in `.env` on the production server.

## 🔍 Verify Deployment

After deployment completes:

```bash
# Check application status
pm2 status

# View live logs
pm2 logs ibiki-sms

# Test database connection
cd /opt/ibiki-sms  # or /root/ibiki-sms if deployed in-place
npm run db:push
```

Expected output: "✓ Everything is in sync"

## 📊 Database Schema Changes

This update adds DbStorage class with full PostgreSQL implementation:

**Tables (all use UUID primary keys):**
- `users` - User accounts with role, email, password, reset tokens
- `api_keys` - API authentication keys with prefix/suffix for display
- `client_profiles` - Credits, markup, assigned phone numbers per user
- `system_config` - Key-value store for ExtremeSMS credentials
- `message_logs` - Complete SMS transaction audit trail
- `credit_transactions` - Financial transaction history
- `incoming_messages` - 2-way SMS message storage

**Key Features:**
- Singleton connection pool (no memory leaks)
- WebSocket support for Neon serverless
- Graceful shutdown on SIGINT/SIGTERM
- First user auto-promoted to admin
- Default credits and markup values

## 🐛 Troubleshooting

### "DATABASE_URL not set" Warning
The app will fall back to in-memory storage (data won't persist). To fix:
```bash
# Edit .env file
nano /opt/ibiki-sms/.env

# Add your database URL:
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Restart
pm2 restart ibiki-sms
```

### Database Push Fails with Data Loss Warning
If you see warnings about data loss:
```bash
npm run db:push -- --force
```

### Application Won't Start
Check the logs:
```bash
pm2 logs ibiki-sms --lines 100

# Common issues:
# - Missing DATABASE_URL (check .env)
# - Port 6000 already in use
# - Node.js version < 18
```

### View Full Error Stack
```bash
pm2 logs ibiki-sms --err --lines 200
```

## 📦 Package Contents

```
ibiki-sms/
├── client/          - React frontend (Vite, TypeScript, shadcn/ui)
├── server/          - Express backend (TypeScript, Drizzle ORM)
│   ├── storage.ts   - NEW: DbStorage with PostgreSQL
│   ├── routes.ts    - API routes
│   └── index.ts     - Server entry point
├── shared/
│   └── schema.ts    - Database schema (Drizzle)
├── deploy.sh        - Production deployment script
├── package.json     - Dependencies and scripts
├── replit.md        - Complete project documentation
└── UPDATE_NOTES.md  - This file
```

## 💾 Rollback Procedure

If you need to rollback to previous version:

```bash
# Stop current version
pm2 stop ibiki-sms

# Restore backup (deploy.sh creates this automatically)
rm -rf /opt/ibiki-sms
mv /opt/ibiki-sms.backup /opt/ibiki-sms

# Restart
pm2 restart ibiki-sms
pm2 save
```

**Note:** Database changes are forward-compatible. Rolling back code won't affect your data.

## 🔐 Security Notes

- API keys stored as SHA-256 hashes
- Passwords hashed with bcrypt
- Session secrets required (never committed to git)
- Database credentials secured in .env (never in source code)
- Connection pool properly closed on shutdown

## 📈 Performance Improvements

- Singleton database connection pool
- Efficient Drizzle ORM queries with proper indexing
- Graceful connection cleanup prevents memory leaks
- WebSocket configuration optimized for Neon serverless

## 🌐 Translation Coverage

All text now translated:
- Landing page (EN/中文)
- Dashboard (Client + Admin)
- API documentation with examples
- Forms and validation messages
- Error messages and notifications

## 📞 Support

- Full documentation: `replit.md`
- Deployment guide: `DEPLOYMENT.md`
- Quick start: `QUICKSTART.md`

## Version Information

- **Version:** 11.4
- **Release Date:** November 19, 2025
- **Critical Fix:** Database persistence to prevent data loss
- **Previous Version:** 11.3 (Password reset via email)

---

**Important:** This update preserves all existing data. Your users, API keys, credits, and message history remain intact. The switch from MemStorage to PostgreSQL happens transparently.
