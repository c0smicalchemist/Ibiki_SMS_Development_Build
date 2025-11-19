# 🚀 Ibiki SMS - Fresh Install Instructions

## 📦 What You Have

**Package:** `ibiki-sms-v11.5.1-COMPLETE-PACKAGE.tar.gz` (74 MB)

**Contents:**
- ✅ All source code (client, server, shared)
- ✅ All dependencies (node_modules - 312 MB)
- ✅ All assets (logo images)
- ✅ Deployment automation (deploy.sh)
- ✅ Complete documentation
- ✅ Database setup guide (NEW!)

**This package is COMPLETE and can be deployed offline!**

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Upload to Server
```bash
scp ibiki-sms-v11.5.1-COMPLETE-PACKAGE.tar.gz root@151.243.109.79:/root/
```

### Step 2: Extract
```bash
ssh root@151.243.109.79
cd /root
tar -xzf ibiki-sms-v11.5.1-COMPLETE-PACKAGE.tar.gz
cd ibiki-sms
```

### Step 3: Build & Deploy
```bash
sudo ./deploy.sh
```

### Step 4: Configure Database (CRITICAL!)
```bash
# Read the database setup guide first
cat DATABASE_SETUP_GUIDE.md

# Option A: Use Neon (recommended - 5 minutes)
# - Go to https://neon.tech
# - Create free account
# - Create new project
# - Copy connection string

# Option B: Use local PostgreSQL
# - Follow guide in DATABASE_SETUP_GUIDE.md

# Add DATABASE_URL to .env
nano .env
# Add: DATABASE_URL=postgresql://your-connection-string

# Restart with new config
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env

# Push database schema
npm run db:push --force
```

### Step 5: Verify
```bash
# Check logs - should NOT show "in-memory storage" warning
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 10

# Test in browser
# Open: http://151.243.109.79
```

---

## 📋 Detailed Installation Steps

### Prerequisites
- Ubuntu/Debian server (tested on Ubuntu 20.04+)
- Root or sudo access
- Internet connection (for Neon database)

### Installation

**1. Install System Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install build tools
sudo apt install -y build-essential
```

**2. Upload & Extract Package**
```bash
# Upload from your local machine
scp ibiki-sms-v11.5.1-COMPLETE-PACKAGE.tar.gz root@151.243.109.79:/root/

# On server
cd /root
tar -xzf ibiki-sms-v11.5.1-COMPLETE-PACKAGE.tar.gz
cd ibiki-sms
```

**3. Run Deployment Script**
```bash
# Make executable
chmod +x deploy.sh

# Deploy (builds frontend, sets up PM2)
sudo ./deploy.sh
```

**What deploy.sh does:**
- ✅ Checks Node.js version
- ✅ Installs/verifies PM2
- ✅ Creates log directory
- ✅ Builds frontend with Vite
- ✅ Builds backend TypeScript
- ✅ Creates PM2 ecosystem config
- ✅ Starts application with PM2
- ✅ Enables PM2 startup on boot

**4. Set Up Database (CRITICAL!)**

**⚠️ WITHOUT THIS STEP, ALL DATA WILL BE LOST ON RESTART!**

**Option A: Neon Cloud Database (RECOMMENDED)**
```bash
# 1. Create Neon account: https://neon.tech
# 2. Create new project (free tier)
# 3. Copy connection string shown after project creation
# 4. Add to .env file

nano .env
# Add this line (replace with YOUR connection string):
# DATABASE_URL=postgresql://user:password@host/database?sslmode=require

# 5. Restart with new environment
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env

# 6. Create database tables
npm run db:push --force

# 7. Verify (should NOT show "in-memory storage" warning)
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 10
```

**Option B: Local PostgreSQL**
```bash
# See DATABASE_SETUP_GUIDE.md for detailed steps
cat DATABASE_SETUP_GUIDE.md
```

**5. Create First Admin User**
```bash
# Open browser and go to:
http://151.243.109.79

# Click "Get Started"
# Fill in signup form
# First user is automatically promoted to admin
```

**6. Configure ExtremeSMS Settings**
```bash
# Login as admin
# Go to Admin Dashboard → System Configuration tab
# Add your ExtremeSMS API key
# Set default pricing (per SMS cost)
# Test connection
```

---

## 🔍 Verification Checklist

After installation, verify everything works:

### ✅ Application Running
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 status
# Should show: ibiki-sms | online
```

### ✅ Port Listening
```bash
sudo ss -tulpn | grep :5000
# Should show: LISTEN on port 5000
```

### ✅ Web Accessible
```bash
curl http://localhost:5000 | head -5
# Should return HTML
```

### ✅ Database Connected (CRITICAL!)
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 5
# Should NOT show: "⚠️ DATABASE_URL not set - using in-memory storage"
# Should show: "serving on port 5000"
```

### ✅ Frontend Loads
- Open browser: http://151.243.109.79
- Should see: Landing page with logo and "Get Started" button
- Language toggle should work (English/Chinese)

### ✅ User Signup Works
- Click "Get Started"
- Create account
- Should login successfully
- Should see Client Dashboard

### ✅ Data Persists (CRITICAL!)
```bash
# 1. Create a test user via signup
# 2. Restart application
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms

# 3. Login with same credentials
# If login works → Database is configured correctly ✅
# If login fails → Database NOT configured (using in-memory storage) ❌
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "in-memory storage" Warning in Logs

**Problem:**
```
⚠️  DATABASE_URL not set - using in-memory storage (data will not persist)
```

**Solution:**
```bash
# Add DATABASE_URL to .env
nano /root/ibiki-sms/.env
# Add: DATABASE_URL=postgresql://your-connection-string

# Restart with environment update
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env

# Verify logs
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 5
```

### Issue 2: Application Not Accessible

**Check PM2 status:**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 status
# Should show: online
```

**Check logs for errors:**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 20
```

**Restart application:**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms
```

### Issue 3: Build Failed

**Problem:**
```
Could not load attached_assets/Yubin_Dash_NOBG_1763476645991.png
```

**Solution:**
```bash
# Verify attached_assets folder exists
ls -la /root/ibiki-sms/attached_assets/

# Should show: Yubin_Dash_NOBG_1763476645991.png

# If missing, re-extract package
cd /root
tar -xzf ibiki-sms-v11.5.1-COMPLETE-PACKAGE.tar.gz --overwrite
cd ibiki-sms
sudo ./deploy.sh
```

### Issue 4: npm run db:push Fails

**Solution:**
```bash
# Use force flag
npm run db:push --force
```

### Issue 5: PM2 Not Found

**Solution:**
```bash
# Install PM2 globally
sudo npm install -g pm2

# Verify installation
pm2 --version
```

---

## 📂 File Structure After Installation

```
/root/ibiki-sms/
├── client/              # Frontend React app
├── server/              # Backend Node.js/Express
├── shared/              # Database schema (Drizzle ORM)
├── node_modules/        # Dependencies (312 MB)
├── attached_assets/     # Logo and images
├── dist/                # Built application (created by deploy.sh)
├── package.json         # Dependencies list
├── deploy.sh            # Deployment automation script
├── .env                 # Configuration (create this!)
├── ecosystem.config.cjs # PM2 configuration
└── DATABASE_SETUP_GUIDE.md  # Database setup instructions
```

---

## 🔐 Environment Configuration (.env)

**Minimum required configuration:**

```bash
# Application
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# Security (auto-generated by deploy.sh)
SESSION_SECRET=<auto-generated-64-char-hex>

# Database (YOU MUST ADD THIS!)
DATABASE_URL=postgresql://user:password@host/database

# Optional: Logging
LOG_LEVEL=info
```

**CRITICAL:** The `.env` file is created by `deploy.sh` but **DATABASE_URL must be added manually**!

---

## 🎯 Post-Installation Configuration

### 1. Configure ExtremeSMS API
- Login as admin
- Go to Admin Dashboard
- Click "System Configuration" tab
- Add ExtremeSMS API key
- Set default SMS pricing
- Click "Test Connection"

### 2. Create Client Accounts
- As admin, go to "Client Management" tab
- Add credits to client accounts
- Clients can generate API keys in their dashboard

### 3. Set Up Nginx (Optional - for HTTPS)
```bash
# Install Nginx
sudo apt install nginx -y

# Configure reverse proxy
sudo nano /etc/nginx/sites-available/ibiki-sms

# Add:
server {
    listen 80;
    server_name 151.243.109.79;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Set Up PM2 Auto-Start on Boot
```bash
# Already done by deploy.sh, but to verify:
PM2_HOME=/home/ibiki/.pm2 pm2 startup systemd
PM2_HOME=/home/ibiki/.pm2 pm2 save
```

---

## 📊 Monitoring & Maintenance

### View Logs
```bash
# Real-time logs
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms

# Last 50 lines
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 50

# Error logs only
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --err
```

### Check Application Status
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 status
PM2_HOME=/home/ibiki/.pm2 pm2 monit  # Real-time monitoring
```

### Restart Application
```bash
# Graceful restart
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms

# With environment update
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env

# Full reload
PM2_HOME=/home/ibiki/.pm2 pm2 reload ibiki-sms
```

### Update Application
```bash
# 1. Upload new package
scp ibiki-sms-vX.X.X.tar.gz root@151.243.109.79:/root/

# 2. Backup current installation
cd /root
mv ibiki-sms ibiki-sms.backup

# 3. Extract new version
tar -xzf ibiki-sms-vX.X.X.tar.gz

# 4. Copy .env from backup
cp ibiki-sms.backup/.env ibiki-sms/.env

# 5. Deploy
cd ibiki-sms
sudo ./deploy.sh

# 6. Push database changes
npm run db:push --force

# 7. Verify
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 10
```

---

## 🎉 You're Done!

Your Ibiki SMS platform is now running at:
**http://151.243.109.79**

**Next steps:**
1. ✅ Create admin account (first signup)
2. ✅ Configure ExtremeSMS API credentials
3. ✅ Create client accounts
4. ✅ Test SMS sending via API
5. ✅ Monitor logs for any issues

**Important reminders:**
- ⚠️ **DATABASE_URL must be configured** or data won't persist
- ⚠️ Backup your .env file (contains SESSION_SECRET)
- ⚠️ First user is auto-promoted to admin
- ⚠️ SESSION_SECRET must never change (logout all users)

---

## 📚 Documentation Included

- **QUICKSTART.md** - Quick deployment guide
- **DEPLOYMENT.md** - Detailed deployment instructions
- **DATABASE_SETUP_GUIDE.md** - Database configuration (CRITICAL!)
- **LOGIN_FIX_GUIDE.md** - Login persistence troubleshooting
- **UPDATE_NOTES.md** - Version history and changes
- **replit.md** - Full architecture documentation

---

**Need help?** Check the included documentation or review PM2 logs for error messages.
