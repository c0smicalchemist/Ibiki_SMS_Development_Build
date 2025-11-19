# 🚀 Ibiki SMS - Complete Deployment Package

## 📦 What's Included

This is a **COMPLETE, ONE-COMMAND deployment package** that includes:

✅ **All Application Code**
- Frontend (React + TypeScript)
- Backend (Node.js + Express)
- Database schema (Drizzle ORM)

✅ **All Dependencies**
- node_modules (312 MB - pre-installed)
- No npm install needed!

✅ **All Assets**
- Logo images
- No build errors!

✅ **Complete Database Setup**
- **NEW:** Automated PostgreSQL installation
- **NEW:** Database creation and configuration
- **NEW:** Secure password generation
- Local database on your server (no external services needed)

✅ **Complete Documentation**
- Installation guides
- Database setup guides
- Troubleshooting guides

---

## ⚡ ONE-COMMAND DEPLOYMENT

### Quick Start (10 Minutes)

**Upload to your server:**
```bash
scp ibiki-sms-v12.0-FULL.tar.gz root@151.243.109.79:/root/
```

**On your server:**
```bash
# Extract package
cd /root
tar -xzf ibiki-sms-v12.0-FULL.tar.gz
cd ibiki-sms

# ONE COMMAND - Does EVERYTHING!
sudo ./full-deploy.sh
```

**That's it!** 🎉

The `full-deploy.sh` script automatically:
1. ✅ Installs PostgreSQL locally
2. ✅ Creates database and user
3. ✅ Generates secure password
4. ✅ Configures application
5. ✅ Builds frontend and backend
6. ✅ Sets up PM2 process manager
7. ✅ Creates database tables
8. ✅ Starts application
9. ✅ Verifies everything works

**Then open:** `http://YOUR_SERVER_IP` and create your admin account!

---

## 📋 What full-deploy.sh Does

### Step 1: PostgreSQL Installation
- Installs PostgreSQL on your server
- Creates database: `ibiki_sms`
- Creates user: `ibiki_user`
- Generates secure random password
- Configures authentication
- Tests database connection

### Step 2: Application Build
- Builds frontend with Vite
- Compiles TypeScript backend
- Creates production bundles
- Optimizes assets

### Step 3: Database Schema
- Creates all database tables:
  - users
  - apiKeys
  - clientProfiles
  - systemConfig
  - messageLogs
  - creditTransactions
  - incomingMessages

### Step 4: Application Startup
- Configures PM2 process manager
- Starts application
- Enables auto-restart on boot
- Sets up logging

### Step 5: Verification
- Checks application is running
- Verifies database connection
- Tests HTTP endpoint
- Shows status summary

---

## 🔐 Database Security

**Automated Setup:**
- ✅ Secure random password (32 characters)
- ✅ Password saved to `.env` file
- ✅ Database user has minimum required privileges
- ✅ PostgreSQL configured for local-only access
- ✅ All credentials stored securely

**View your database credentials:**
```bash
cat /root/ibiki-sms/.env | grep DATABASE_URL
```

**Backup your database:**
```bash
sudo -u postgres pg_dump ibiki_sms > /root/ibiki-sms-backup-$(date +%Y%m%d).sql
```

**Restore from backup:**
```bash
sudo -u postgres psql ibiki_sms < /root/ibiki-sms-backup-YYYYMMDD.sql
```

---

## 📁 Deployment Scripts Included

### 1. `full-deploy.sh` - Complete Deployment (RECOMMENDED)
**Use this for fresh installations!**

Does everything in one command:
```bash
sudo ./full-deploy.sh
```

**Perfect for:**
- ✅ Fresh server installations
- ✅ First-time deployment
- ✅ Complete setup from scratch

---

### 2. `setup-postgres.sh` - PostgreSQL Only
**Use this if you already deployed but need to add PostgreSQL:**

```bash
sudo ./setup-postgres.sh
```

Does:
- Installs PostgreSQL
- Creates database and user
- Configures .env file
- Does NOT build application

**Perfect for:**
- Switching from Neon to local PostgreSQL
- Re-configuring database
- Database-only setup

---

### 3. `deploy.sh` - Application Only
**Use this for updates (when database already exists):**

```bash
sudo ./deploy.sh
```

Does:
- Builds application
- Sets up PM2
- Does NOT touch PostgreSQL
- Does NOT modify .env

**Perfect for:**
- Application updates
- Code changes
- Rebuilding after changes

---

## 🎯 Common Deployment Scenarios

### Scenario 1: Fresh Installation (NEW SERVER)
```bash
# Upload package
scp ibiki-sms-v12.0-FULL.tar.gz root@YOUR_SERVER:/root/

# SSH to server
ssh root@YOUR_SERVER
cd /root
tar -xzf ibiki-sms-v12.0-FULL.tar.gz
cd ibiki-sms

# ONE COMMAND!
sudo ./full-deploy.sh

# Open browser: http://YOUR_SERVER_IP
# Create admin account
```

---

### Scenario 2: Update Application (Keep Database)
```bash
# Upload new package
scp ibiki-sms-vX.X.X.tar.gz root@YOUR_SERVER:/root/

# SSH to server
ssh root@YOUR_SERVER

# Backup .env file
cp /root/ibiki-sms/.env /root/.env.backup

# Extract new version
cd /root
mv ibiki-sms ibiki-sms.old
tar -xzf ibiki-sms-vX.X.X.tar.gz
cd ibiki-sms

# Restore .env
cp /root/.env.backup .env

# Deploy application only (skip PostgreSQL)
sudo ./deploy.sh

# Push any schema changes
npm run db:push --force

# Restart
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env
```

---

### Scenario 3: Switch from Neon to Local PostgreSQL
```bash
# You already have application running with Neon
cd /root/ibiki-sms

# Install PostgreSQL and create local database
sudo ./setup-postgres.sh

# Restart application
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env

# Push schema to new database
npm run db:push --force

# Your data from Neon is NOT migrated automatically
# You'll need to recreate admin user
```

---

### Scenario 4: Re-deploy Everything (Fresh Start)
```bash
# Stop and remove old installation
PM2_HOME=/home/ibiki/.pm2 pm2 delete ibiki-sms
sudo rm -rf /root/ibiki-sms

# Drop old database
sudo -u postgres dropdb ibiki_sms
sudo -u postgres dropuser ibiki_user

# Extract package
cd /root
tar -xzf ibiki-sms-v12.0-FULL.tar.gz
cd ibiki-sms

# Deploy everything fresh
sudo ./full-deploy.sh
```

---

## 🔍 Verification & Troubleshooting

### Check Application Status
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 status
```

**Expected:**
```
┌────┬──────────┬─────┬────────┬───────┐
│ id │ name     │ ... │ status │ ...   │
├────┼──────────┼─────┼────────┼───────┤
│ 0  │ibiki-sms │ ... │ online │ ...   │
└────┴──────────┴─────┴────────┴───────┘
```

---

### Check Application Logs
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 20
```

**Should see:**
```
✅ 11:29:53 AM [express] serving on port 5000
```

**Should NOT see:**
```
❌ ⚠️  DATABASE_URL not set - using in-memory storage
```

---

### Check PostgreSQL Status
```bash
sudo systemctl status postgresql
```

**Expected:** `active (running)`

---

### Test Database Connection
```bash
sudo -u postgres psql -d ibiki_sms -c "SELECT 1;"
```

**Expected:** 
```
 ?column? 
----------
        1
```

---

### View Database Tables
```bash
sudo -u postgres psql -d ibiki_sms -c "\dt"
```

**Expected tables:**
- users
- apiKeys
- clientProfiles
- systemConfig
- messageLogs
- creditTransactions
- incomingMessages

---

### Test HTTP Endpoint
```bash
curl http://localhost:5000 | head -5
```

**Expected:** HTML output with `<!DOCTYPE html>`

---

### Check Database Connection in Logs
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 50 | grep -i database
```

**Should NOT contain:** "in-memory storage" warning

---

## 🚨 Troubleshooting

### Issue: PostgreSQL Installation Fails

**Error:** `Failed to install PostgreSQL`

**Solution:**
```bash
# Update package list
sudo apt update

# Try installing manually
sudo apt install postgresql postgresql-contrib -y

# Then run setup again
sudo ./setup-postgres.sh
```

---

### Issue: Database Connection Fails

**Error:** `Database connection test failed`

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check .env has DATABASE_URL
cat .env | grep DATABASE_URL

# Try connecting manually
sudo -u postgres psql -d ibiki_sms
```

---

### Issue: Application Shows "in-memory storage"

**Problem:** Application not reading DATABASE_URL from .env

**Solution:**
```bash
# Check .env file exists and has DATABASE_URL
cat /root/ibiki-sms/.env | grep DATABASE_URL

# Restart with environment update
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env

# Check logs again
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 10
```

---

### Issue: Port 5000 Already in Use

**Solution:**
```bash
# Find what's using port 5000
sudo ss -tulpn | grep :5000

# Kill the process or use different port
export APP_PORT=6000
sudo ./full-deploy.sh
```

---

### Issue: Build Fails with Asset Error

**Error:** `Could not load attached_assets/...`

**Solution:**
```bash
# Verify attached_assets folder exists
ls -la attached_assets/

# Re-extract package if missing
cd /root
tar -xzf ibiki-sms-v12.0-FULL.tar.gz --overwrite
cd ibiki-sms
sudo ./full-deploy.sh
```

---

## 📊 System Requirements

**Operating System:**
- Ubuntu 20.04+ (recommended)
- Debian 10+ (recommended)
- Other Linux distributions (may work)

**Resources:**
- RAM: 1 GB minimum, 2 GB recommended
- Disk: 2 GB free space
- CPU: 1 core minimum

**Network:**
- Internet access for initial setup
- Open port (default: 5000)

**Software (auto-installed):**
- Node.js 20+
- PostgreSQL 12+
- PM2
- Build tools

---

## 📚 Documentation Files Included

| File | Purpose |
|------|---------|
| `README_FIRST.txt` | Quick overview |
| `FULL_DEPLOYMENT_README.md` | **This file - complete deployment guide** |
| `DATABASE_SETUP_GUIDE.md` | PostgreSQL setup details |
| `FRESH_INSTALL_INSTRUCTIONS.md` | Step-by-step installation |
| `CURRENT_STATUS_SUMMARY.md` | Deployment status checker |
| `LOGIN_FIX_GUIDE.md` | Login persistence troubleshooting |
| `DEPLOYMENT.md` | Detailed deployment documentation |
| `QUICKSTART.md` | Quick start guide |
| `replit.md` | Architecture documentation |

---

## 🎉 Post-Deployment Steps

### 1. Create Admin Account
```bash
# Open browser
http://YOUR_SERVER_IP

# Click "Get Started"
# Fill signup form
# First user is automatically admin!
```

### 2. Configure ExtremeSMS
```bash
# Login as admin
# Go to: Admin Dashboard → System Configuration
# Add ExtremeSMS API key
# Set default SMS pricing
# Click "Test Connection"
```

### 3. Create Client Accounts
```bash
# Admin Dashboard → Client Management
# Add credits to clients
# Clients can login and generate API keys
```

### 4. Test SMS Sending
```bash
curl -X POST http://YOUR_SERVER_IP/api/v2/sms/sendsingle \
  -H "Authorization: Bearer CLIENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "+1234567890", "message": "Test SMS"}'
```

### 5. Set Up Backups (Recommended)
```bash
# Create backup script
cat > /root/backup-ibiki.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sudo -u postgres pg_dump ibiki_sms > /root/backups/ibiki-sms-$DATE.sql
find /root/backups -name "ibiki-sms-*.sql" -mtime +7 -delete
EOF

chmod +x /root/backup-ibiki.sh

# Create backups directory
mkdir -p /root/backups

# Add to crontab (daily backups at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-ibiki.sh") | crontab -
```

---

## 🔄 Updates & Maintenance

### Check for Updates
```bash
# Visit repository for new versions
# Download new package
# Follow "Scenario 2: Update Application" above
```

### View Application Logs
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms
```

### Restart Application
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms
```

### Monitor Application
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 monit
```

---

## ✅ Success Checklist

After deployment, verify:

- [ ] `sudo systemctl status postgresql` shows "active (running)"
- [ ] `PM2_HOME=/home/ibiki/.pm2 pm2 status` shows ibiki-sms "online"
- [ ] `curl http://localhost:5000` returns HTML
- [ ] Browser can access `http://YOUR_SERVER_IP`
- [ ] Logs do NOT show "in-memory storage" warning
- [ ] Can create admin account via signup
- [ ] Can login and access dashboard
- [ ] Database tables exist (check with `\dt` in psql)
- [ ] Application restarts preserve user data

---

## 🎯 Support

**Included Documentation:**
- Read all `.md` files in package
- Check troubleshooting sections
- Review PM2 logs for errors

**Database Issues:**
- `cat DATABASE_SETUP_GUIDE.md`

**Login Issues:**
- `cat LOGIN_FIX_GUIDE.md`

**General Deployment:**
- `cat DEPLOYMENT.md`

---

## 🔐 Security Notes

**Important:**
1. ✅ Database password is auto-generated (32 characters)
2. ✅ Password stored in `.env` file
3. ⚠️ Backup `.env` file securely!
4. ⚠️ Change SESSION_SECRET if needed
5. ✅ PostgreSQL configured for local access only
6. ⚠️ Consider setting up firewall (ufw)
7. ⚠️ Consider setting up SSL/TLS with Nginx

**Recommended: Set up firewall**
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 5000  # Application
sudo ufw enable
```

---

**Your complete, production-ready SMS API platform is now deployed!** 🚀
