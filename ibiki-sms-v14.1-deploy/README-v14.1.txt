=============================================================================
IBIKI SMS v14.1 - DATABASE FIX DEPLOYMENT
=============================================================================

📦 Version: 14.1
🎯 Critical Fix: Admin dashboard now shows clients
⚡ Deploy Time: 5 minutes

=============================================================================
🐛 WHAT THIS FIXES
=============================================================================

PROBLEM:
- Created users but admin dashboard shows empty table
- Can't see clients to allocate credits
- "Failed to fetch clients" error

ROOT CAUSE:
- Database schema out of sync
- Missing "sender_phone_number" column in message_logs table
- API endpoint crashed when fetching clients

FIX:
✅ Database schema synced with npm run db:push
✅ Missing column added automatically
✅ Admin dashboard now loads clients correctly
✅ Can allocate credits and manage clients

=============================================================================
⚡ QUICK DEPLOYMENT
=============================================================================

1️⃣ UPLOAD TO SERVER:
   scp ibiki-sms-v14.1.tar.gz root@151.243.109.79:/root/

2️⃣ SSH INTO SERVER:
   ssh root@151.243.109.79

3️⃣ EXTRACT:
   cd /root
   tar -xzf ibiki-sms-v14.1.tar.gz
   cd ibiki-sms-v14.1-deploy

4️⃣ DEPLOY:
   chmod +x deploy-v14.1.sh
   ./deploy-v14.1.sh

5️⃣ VERIFY THE FIX:
   - Open http://151.243.109.79
   - Login as admin
   - Go to Clients tab
   - You should see all registered clients!

DONE! Total time: 5 minutes

=============================================================================
✅ WHAT THE DEPLOYMENT DOES
=============================================================================

1. Stops all PM2 processes cleanly
2. Clears port 5000 conflicts
3. Copies updated code to /root/ibiki-sms
4. Creates .env with DATABASE_URL
5. Installs dependencies
6. Builds application
7. **RUNS DATABASE MIGRATION (THE FIX!)** ← Critical step
8. Starts PM2 with correct name
9. Verifies everything is running

=============================================================================
🎯 VERIFY IT WORKED
=============================================================================

After deployment, check these:

✅ PM2 Status:
   pm2 status
   
   Should show: ibiki-sms | online

✅ Logs:
   pm2 logs ibiki-sms --lines 30
   
   Should show:
   - "serving on port 5000"
   - NO errors about "sender_phone_number"

✅ Admin Dashboard:
   1. Open http://151.243.109.79
   2. Login with admin account (testuser_9W3j1O@example.com)
   3. Click "Admin Dashboard"
   4. Click "Clients" tab
   5. You should see:
      - test@example.com
      - Credits: $50.00
      - Status: active
      - Add Credits button

=============================================================================
📊 YOUR DATA IS SAFE
=============================================================================

All existing data preserved:
✅ Users (admin and clients)
✅ Credits balances
✅ API keys
✅ Message logs
✅ All configuration

This deployment ONLY:
✅ Adds missing database column
✅ Fixes the API endpoint
✅ Updates application code

NOTHING is deleted or lost!

=============================================================================
🎉 AFTER DEPLOYMENT
=============================================================================

You can now:
✅ See all registered clients in admin dashboard
✅ Allocate credits to any client
✅ View client balances and activity
✅ Assign phone numbers to clients
✅ Manage all clients from one place

Your clients can:
✅ Login to their dashboard
✅ See their credit balance
✅ See their per-SMS rate
✅ Send SMS messages
✅ View message history

=============================================================================
🔧 TROUBLESHOOTING
=============================================================================

Problem: Still not seeing clients
Fix:
   cd /root/ibiki-sms
   npm run db:push --force
   pm2 restart ibiki-sms

Problem: Port 5000 in use
Fix:
   lsof -ti:5000 | xargs kill -9
   ./deploy-v14.1.sh

Problem: PM2 not starting
Fix:
   pm2 delete all
   pm2 kill
   ./deploy-v14.1.sh

Problem: Database connection error
Fix:
   # Check PostgreSQL is running
   systemctl status postgresql
   
   # Check .env has correct DATABASE_URL
   cat /root/ibiki-sms/.env

=============================================================================
📞 QUICK COMMANDS
=============================================================================

Check status:       pm2 status
View logs:          pm2 logs ibiki-sms --lines 50
Restart:            pm2 restart ibiki-sms
Check database:     PGPASSWORD=Cosmic4382 psql -U ibiki_user -d ibiki_sms
Run migration:      cd /root/ibiki-sms && npm run db:push

=============================================================================
💡 TECHNICAL DETAILS
=============================================================================

What npm run db:push does:
1. Reads shared/schema.ts (your data model)
2. Compares with actual PostgreSQL tables
3. Generates ALTER TABLE commands
4. Adds missing columns safely
5. Updates indexes if needed
6. Never deletes data

Column added:
- message_logs.sender_phone_number (text, nullable)
- Used for 2-way SMS routing
- Allows tracking which number sent each message

This column was in the schema but missing from database.
Without it, the admin clients endpoint crashed.

=============================================================================
🚀 VERSION HISTORY
=============================================================================

v14.1 (Current)
- FIX: Database schema sync issue
- FIX: Admin dashboard shows clients correctly
- FIX: Added sender_phone_number column
- Improved deployment script with db:push

v14.0
- Credit allocation system
- Client pricing display
- Logo fixes
- PM2 name fixes

=============================================================================
