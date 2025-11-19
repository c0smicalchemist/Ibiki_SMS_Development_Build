# Ibiki SMS v15.0 - Production Deployment Guide

## 🎯 What's Fixed in v15.0

### ✅ CRITICAL FIX: Database Persistence
- **DATABASE_URL now embedded directly in PM2 config** - No more env_file issues!
- **Users WILL persist across restarts** - Data is saved to PostgreSQL
- **Fail-fast on missing DATABASE_URL** - Server won't start with in-memory storage in production

### ✅ Missing API v1 Endpoint Added
- **GET /api/v1/sms/status/{messageId}** - Now available with local cache fallback
- Matches v2 behavior for offline resilience

### ✅ Deployment Safety Improvements
- **Staging directory** - Build and test BEFORE replacing production
- **Automatic rollback** - If PM2 fails to start, previous deployment is restored
- **PostgreSQL verification** - Script confirms database connection after deployment

### ✅ 2-Way SMS Receive (Already Implemented)
- **Webhook endpoint**: POST /webhook/incoming-sms
- **Smart routing**: Business field → Conversation tracking → Assigned phone numbers
- **Client inbox API**: GET /api/v2/sms/inbox
- **Full message storage** in PostgreSQL

---

## 📦 Deployment Instructions

### Step 1: Upload Package
```bash
scp ibiki-sms-v15.0-production.tar.gz root@151.243.109.79:/root/
```

### Step 2: Extract and Deploy
```bash
ssh root@151.243.109.79
cd /root
tar -xzf ibiki-sms-v15.0-production.tar.gz
cd ibiki-sms-v15.0-production
chmod +x deploy-v15.0.sh
./deploy-v15.0.sh
```

### Step 3: Verify Deployment
The script will automatically verify:
- ✅ PostgreSQL connection
- ✅ Database schema sync
- ✅ PM2 startup
- ✅ Application using PostgreSQL (not in-memory storage)

---

## ✅ Post-Deployment Verification

### 1. Check Application Status
```bash
pm2 status
```
**Expected**: `ibiki-sms | online`

### 2. Verify PostgreSQL Connection
```bash
pm2 logs ibiki-sms --lines 30
```
**Must see**:
```
✅ Using PostgreSQL database storage
✅ Database: ibiki_user@localhost:5432/ibiki_sms
```

**If you see** `⚠️ DATABASE_URL not set - using in-memory storage`:
```bash
# This should NOT happen with v15.0, but if it does:
pm2 delete ibiki-sms
cd /root/ibiki-sms
pm2 start ecosystem.config.cjs
pm2 save
```

### 3. Test User Persistence
```bash
# Check users table
PGPASSWORD=Cosmic4382 psql -U ibiki_user -d ibiki_sms -c "SELECT id, email, role FROM users;"
```

### 4. Test API v1 Endpoint
```bash
# Replace YOUR_API_KEY and MESSAGE_ID
curl -X GET http://localhost:5000/api/v1/sms/status/{MESSAGE_ID} \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 🔧 Troubleshooting

### Users Still Not Persisting?
```bash
# 1. Check PM2 logs
pm2 logs ibiki-sms --lines 50

# 2. Verify DATABASE_URL in PM2 process
pm2 env ibiki-sms | grep DATABASE_URL

# 3. Test database connection manually
PGPASSWORD=Cosmic4382 psql -U ibiki_user -h localhost -p 5432 -d ibiki_sms -c "SELECT 1;"
```

### PM2 Won't Start?
```bash
# Check ecosystem config
cat /root/ibiki-sms/ecosystem.config.cjs

# Try manual start with logs
cd /root/ibiki-sms
NODE_ENV=production DATABASE_URL='postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms' node dist/index.js
```

### Build Failed?
The deployment script now uses staging - your old deployment is backed up to:
```
/root/ibiki-sms-backup-{TIMESTAMP}
```

---

## 📊 API Endpoints

### External Client API (API Key Auth)

**v1 Endpoints:**
- GET /api/v1/sms/status/{messageId} - Check message status (with local cache fallback)

**v2 Endpoints:**
- POST /api/v2/sms/sendsingle - Send single SMS
- POST /api/v2/sms/sendbulk - Send bulk SMS (same message)
- POST /api/v2/sms/sendbulkmulti - Send bulk SMS (different messages)
- GET /api/v2/sms/messages - Get sent messages
- GET /api/v2/sms/status/{messageId} - Check message status
- GET /api/v2/sms/inbox - Get incoming messages (2-way SMS)
- GET /api/v2/account/balance - Check credit balance

### Dashboard API (JWT Auth)
- POST /api/auth/login
- POST /api/auth/register
- GET /api/dashboard/clients - Admin: List all clients
- GET /api/dashboard/credits - Get my credits
- POST /api/dashboard/credits/adjust - Admin: Add/deduct credits
- And more...

### Webhook
- POST /webhook/incoming-sms - Receive incoming SMS from ExtremeSMS

---

## 🔐 Database Connection

**Embedded in ecosystem.config.cjs:**
```javascript
DATABASE_URL: 'postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms'
```

**To change database credentials:**
1. Edit `/root/ibiki-sms/ecosystem.config.cjs`
2. Update the `DATABASE_URL` value
3. Restart: `pm2 restart ibiki-sms`
4. Save: `pm2 save`

---

## 🎉 Success Indicators

✅ **PM2 Status**: `online`  
✅ **Logs**: "Using PostgreSQL database storage"  
✅ **Database**: Users table populated  
✅ **API v1**: /api/v1/sms/status/{messageId} returns 200  
✅ **Persistence**: Users remain after `pm2 restart ibiki-sms`  

---

## 📞 Support

If you still experience issues after following this guide:
1. Save PM2 logs: `pm2 logs ibiki-sms --lines 200 > /root/ibiki-sms-logs.txt`
2. Save database state: `PGPASSWORD=Cosmic4382 pg_dump -U ibiki_user ibiki_sms > /root/ibiki-sms-db-dump.sql`
3. Contact support with both files
