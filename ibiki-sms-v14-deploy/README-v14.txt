=============================================================================
IBIKI SMS v14 - DEPLOYMENT THAT WORKS
=============================================================================

📦 Version: 14
🎯 Status: COMPLETE
⚡ Deploy Time: 5 minutes

=============================================================================
QUICK START
=============================================================================

Upload package:
  scp ibiki-sms-v14.tar.gz root@151.243.109.79:/root/

Extract:
  cd /root
  tar -xzf ibiki-sms-v14.tar.gz
  cd ibiki-sms-v14-deploy

Deploy:
  chmod +x deploy-v14.sh
  ./deploy-v14.sh

That's it!

=============================================================================
IF SERVICE IS DOWN RIGHT NOW
=============================================================================

Run emergency fix:
  chmod +x EMERGENCY-FIX.sh
  ./EMERGENCY-FIX.sh

This will get you back online in 2 minutes.

=============================================================================
WHAT'S FIXED IN v14
=============================================================================

✅ PM2 process name fixed (always "ibiki-sms" not "ibiki-sm")
✅ DATABASE_URL loads correctly
✅ Port 5000 conflicts auto-cleared
✅ .npmrc removed (was causing errors)
✅ Logo file included
✅ Clean PM2 startup
✅ Credits management working
✅ All your data preserved

=============================================================================
DEPLOYMENT STEPS
=============================================================================

1. Upload:
   scp ibiki-sms-v14.tar.gz root@151.243.109.79:/root/

2. SSH:
   ssh root@151.243.109.79

3. Extract:
   cd /root
   tar -xzf ibiki-sms-v14.tar.gz
   cd ibiki-sms-v14-deploy

4. Deploy:
   chmod +x deploy-v14.sh
   ./deploy-v14.sh

5. Wait 5 minutes

6. Open browser:
   http://151.243.109.79

DONE!

=============================================================================
WHAT THE SCRIPT DOES
=============================================================================

1. Kills all PM2 processes
2. Kills everything on port 5000
3. Copies files to /root/ibiki-sms
4. Creates .env with DATABASE_URL
5. Removes .npmrc (causes errors)
6. npm install
7. npm run build
8. Database migration
9. PM2 start with name "ibiki-sms"
10. Saves PM2 config

=============================================================================
VERIFY DEPLOYMENT
=============================================================================

Check status:
  pm2 status

Should show:
  ibiki-sms | online

Check logs:
  pm2 logs ibiki-sms --lines 30

Should see:
  ✅ "serving on port 5000"
  ✅ NO "DATABASE_URL not set"

Open browser:
  http://151.243.109.79

Should show:
  ✅ Login page
  ✅ Your data intact

=============================================================================
TROUBLESHOOTING
=============================================================================

Problem: Port 5000 in use
Fix:
  lsof -ti:5000 | xargs kill -9
  ./deploy-v14.sh

Problem: PM2 shows wrong name
Fix:
  pm2 delete all
  ./deploy-v14.sh

Problem: DATABASE_URL not loading
Fix:
  cat /root/ibiki-sms/.env
  pm2 restart ibiki-sms --update-env

Problem: Everything broken
Fix:
  ./EMERGENCY-FIX.sh

=============================================================================
YOUR DATA IS SAFE
=============================================================================

Your PostgreSQL database contains:
- All users
- All credits
- All message logs
- All API keys
- All configuration

This deployment just reconnects to it.
NOTHING is deleted or lost.

=============================================================================
QUICK COMMANDS
=============================================================================

Status:       pm2 status
Logs:         pm2 logs ibiki-sms --lines 30
Restart:      pm2 restart ibiki-sms
Stop:         pm2 stop ibiki-sms
Emergency:    ./EMERGENCY-FIX.sh

=============================================================================
SUCCESS CHECKLIST
=============================================================================

After deployment:
□ PM2 shows "ibiki-sms | online"
□ Logs show "serving on port 5000"
□ No "DATABASE_URL not set" warning
□ Browser shows login page
□ Can login with existing user
□ Data is intact

=============================================================================
PACKAGE CONTENTS
=============================================================================

- deploy-v14.sh          (Main deployment script)
- EMERGENCY-FIX.sh       (Quick recovery)
- README-v14.txt         (This file)
- server/                (Backend code)
- client/                (Frontend code)
- shared/                (Database schema)
- package.json           (Dependencies)
- All other files        (Complete application)

=============================================================================
TIME ESTIMATE
=============================================================================

Emergency fix:    2-3 minutes
Full deployment:  5-7 minutes
Build time:       2-3 minutes
Startup time:     30 seconds

=============================================================================
SUPPORT
=============================================================================

If deployment fails, check:
1. PostgreSQL is running
2. Port 5000 is free
3. .env file exists
4. PM2 is installed

Then run: ./EMERGENCY-FIX.sh

=============================================================================
