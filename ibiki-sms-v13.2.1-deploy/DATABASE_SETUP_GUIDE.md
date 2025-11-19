# 🗄️ Database Setup Guide for Ibiki SMS

## Problem
Your application is running but using **in-memory storage**. All data (users, API keys, settings) will be lost when the server restarts.

**Current log warning:**
```
⚠️  DATABASE_URL not set - using in-memory storage (data will not persist)
```

---

## ✅ Solution: Set Up PostgreSQL Database

You have **two options** for setting up a persistent database:

---

## Option 1: Neon Cloud Database (RECOMMENDED) ⭐

**Advantages:**
- ✅ Free tier available (up to 512 MB)
- ✅ No server setup required
- ✅ Automatic backups
- ✅ Serverless PostgreSQL (scales automatically)
- ✅ 5-minute setup

### Step-by-Step Setup

**1. Create Neon Account**
- Go to: https://neon.tech
- Sign up (free account)
- Create a new project

**2. Get Database Connection String**
After creating project, Neon will show you a connection string:
```
postgresql://[user]:[password]@[host]/[database]?sslmode=require
```

**Example:**
```
postgresql://ibiki_user:AbCd1234XyZ@ep-cool-lake-12345.us-east-2.aws.neon.tech/ibiki_sms?sslmode=require
```

**3. Add to .env File**
SSH into your server:
```bash
ssh root@151.243.109.79
cd /root/ibiki-sms
nano .env
```

Add the DATABASE_URL (replace with YOUR actual connection string from Neon):
```bash
DATABASE_URL=postgresql://[your-neon-connection-string]
```

**4. Restart Application**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms
```

**5. Push Database Schema**
```bash
npm run db:push --force
```

**6. Verify Database is Connected**
```bash
# Check logs - should NOT show "in-memory storage" warning
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 5

# Test connection
curl http://localhost:5000
```

**7. Create First Admin User**
- Open browser: http://151.243.109.79
- Click "Get Started" → Sign up
- First user is automatically promoted to admin
- Login and configure ExtremeSMS settings

---

## Option 2: Local PostgreSQL on Server

**Advantages:**
- ✅ Full control
- ✅ No external dependencies
- ❌ Requires more setup
- ❌ You manage backups

### Step-by-Step Setup

**1. Install PostgreSQL**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y
```

**2. Start PostgreSQL**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**3. Create Database and User**
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE ibiki_sms;
CREATE USER ibiki_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE ibiki_sms TO ibiki_user;
\q
```

**4. Update .env File**
```bash
cd /root/ibiki-sms
nano .env
```

Add (replace password with your actual password):
```bash
DATABASE_URL=postgresql://ibiki_user:your_secure_password_here@localhost:5432/ibiki_sms
```

**5. Restart Application**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms
```

**6. Push Database Schema**
```bash
npm run db:push --force
```

**7. Verify**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 5
```

---

## 🔍 Verification Checklist

After setting up the database, verify it's working:

**1. Check Logs (should NOT see warning)**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 10
```

**Expected output:**
```
✅ 11:29:53 AM [express] serving on port 5000
```

**NOT this:**
```
❌ ⚠️  DATABASE_URL not set - using in-memory storage
```

**2. Test User Signup**
- Open: http://151.243.109.79
- Sign up with email/password
- Login
- Restart server: `PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms`
- Login again - **should still work** (proves data persisted)

**3. Check Database Tables**
```bash
# If using local PostgreSQL:
sudo -u postgres psql -d ibiki_sms -c "\dt"

# Should show tables:
# - users
# - apiKeys
# - clientProfiles
# - systemConfig
# - messageLogs
# - creditTransactions
# - incomingMessages
```

---

## 🚨 Troubleshooting

### Issue: "Could not connect to database"

**Check connection string format:**
```bash
# Neon format (serverless):
DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# Local format:
DATABASE_URL=postgresql://user:password@localhost:5432/database
```

**Test connection manually:**
```bash
# Install psql client if not available
sudo apt install postgresql-client -y

# Test connection (replace with your connection string)
psql "postgresql://user:password@host/database"
```

### Issue: "npm run db:push" fails

**Use force flag:**
```bash
npm run db:push --force
```

### Issue: Old data disappeared after restart

**This means:**
- DATABASE_URL is not set correctly
- Application fell back to in-memory storage
- Check .env file exists and has correct DATABASE_URL

**Fix:**
```bash
cd /root/ibiki-sms
cat .env | grep DATABASE_URL
# Should show your connection string

# If missing, add it and restart
nano .env
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms
```

---

## 📊 Comparison: Neon vs Local PostgreSQL

| Feature | Neon (Cloud) | Local PostgreSQL |
|---------|--------------|------------------|
| Setup time | 5 minutes | 15 minutes |
| Cost | Free tier available | Free (self-hosted) |
| Backups | Automatic | Manual setup needed |
| Scaling | Automatic | Manual |
| Maintenance | Managed | You maintain |
| Connection | Internet required | Local only |
| **Recommended for** | **Production** | Development/testing |

---

## 🎯 Recommended Setup

**For production deployment on 151.243.109.79:**

1. **Use Neon Cloud Database** (Option 1)
2. Takes 5 minutes to set up
3. Free tier is sufficient for most use cases
4. Automatic backups and scaling
5. No server maintenance required

---

## ✅ Next Steps After Database Setup

Once database is configured and working:

1. **Create first admin user** (auto-promoted)
2. **Configure ExtremeSMS credentials** in admin dashboard
3. **Test SMS sending** via API
4. **Set up monitoring** (optional - PM2 + logs)
5. **Configure Nginx** for HTTPS (optional)

---

## 📞 Need Help?

**Common issues:**
- `.env` file not being read → Check file is in `/root/ibiki-sms/` directory
- Connection refused → Check DATABASE_URL format (especially for Neon, include `?sslmode=require`)
- Schema not created → Run `npm run db:push --force`
- Data still disappearing → Restart didn't pick up new .env (use `--update-env` flag)

**Restart with environment update:**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env
```

---

**Your application is running successfully! Just need to configure the database for data persistence.** 🚀
