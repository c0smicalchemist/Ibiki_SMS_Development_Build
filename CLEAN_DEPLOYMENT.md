# Ibiki SMS - Complete Clean Deployment Guide

## 📦 **DEPLOYMENT PACKAGE**

This guide will help you deploy **Ibiki SMS** to your server at **151.243.109.79** from scratch.

---

## **PREREQUISITES**

Before starting, ensure you have:
- ✅ SSH access to your server (root or sudo user)
- ✅ Server running Ubuntu/Debian Linux
- ✅ Domain name pointed to your server (optional but recommended)
- ✅ ExtremeSMS API key (you'll configure this after deployment)

---

## **PART 1: PREPARE DEPLOYMENT PACKAGE**

### **Step 1: Download Project Files**

From Replit, download your entire project:

**Option A: Download as ZIP**
1. Click the three dots `⋮` in Files panel
2. Select "Download as zip"
3. Extract the ZIP on your computer
4. You should have a folder with all project files

**Option B: Use Git**
```bash
# If your project is in a Git repository
git clone <your-repo-url> ibiki-sms
cd ibiki-sms
```

### **Step 2: Verify You Have These Files**

Make sure your folder contains:
```
ibiki-sms/
├── deploy.sh           ← Deployment script (IMPORTANT!)
├── client/             ← Frontend code
├── server/             ← Backend code
├── shared/             ← Shared types
├── package.json        ← Dependencies
├── vite.config.ts      ← Build config
├── tsconfig.json       ← TypeScript config
└── ... other files
```

**CRITICAL:** You need `deploy.sh` - if it's missing, download it from Replit.

---

## **PART 2: UPLOAD TO SERVER**

### **Method A: Using Command Line (Mac/Linux)**

```bash
# Open Terminal on your computer
# Navigate to your EXTRACTED folder (whatever it's named!)
cd ~/Downloads/IbikiGateway  # Or whatever your folder is called

# Upload entire folder to server (using a temporary name)
scp -r . root@151.243.109.79:/root/deploy-temp/

# Enter password when prompted
```

### **Method B: Using FileZilla (Windows/Mac/Linux)**

1. **Download FileZilla:** https://filezilla-project.org/

2. **Connect to Server:**
   - Protocol: `SFTP`
   - Host: `151.243.109.79`
   - Username: `root`
   - Password: `your-root-password`
   - Port: `22`
   - Click "Quickconnect"

3. **Upload Files:**
   - Right panel: Navigate to `/root/`
   - Left panel: Find your `ibiki-sms` folder
   - Drag entire folder to right panel
   - Wait for upload (~2-5 minutes)

### **Method C: Using WinSCP (Windows)**

1. **Download WinSCP:** https://winscp.net/

2. **New Session:**
   - File protocol: `SFTP`
   - Host: `151.243.109.79`
   - Port: `22`
   - Username: `root`
   - Password: `your-root-password`
   - Click "Login"

3. **Upload:**
   - Right panel: `/root/`
   - Left panel: Your `ibiki-sms` folder
   - Drag folder to right panel

---

## **PART 3: DEPLOY ON SERVER**

### **Step 1: Connect via SSH**

```bash
ssh root@151.243.109.79
```

Enter your password.

### **Step 2: Navigate to Uploaded Folder**

```bash
cd /root/deploy-temp
```

### **Step 3: Verify Files**

```bash
# List files
ls -la

# You should see:
# deploy.sh, client/, server/, package.json, etc.

# Check deploy script exists
ls -lh deploy.sh
```

### **Step 4: Make Deploy Script Executable**

```bash
chmod +x deploy.sh
```

### **Step 5: Run Deployment**

#### **Option A: Default Deployment (Port 3100)**

```bash
sudo ./deploy.sh
```

#### **Option B: Custom Port and Domain**

```bash
# Set environment variables first
export APP_PORT=3100
export DOMAIN=sms.yourdomain.com

# Then deploy
sudo ./deploy.sh
```

#### **Option C: Skip Nginx (Configure Manually Later)**

```bash
export SKIP_NGINX=true
sudo ./deploy.sh
```

### **Step 6: Wait for Deployment**

The script will:
1. ✅ Check Node.js (installs if missing) - **2 min**
2. ✅ Create `ibiki` user
3. ✅ Copy files to `/opt/ibiki-sms/`
4. ✅ Install dependencies - **3-5 min**
5. ✅ Build frontend - **1-2 min**
6. ✅ Build backend - **30 sec**
7. ✅ Install PM2
8. ✅ Configure Nginx
9. ✅ Start application

**Total time: 5-10 minutes**

You'll see output like:
```
=================================
Ibiki SMS Deployment Script
=================================

[✓] Checking system requirements...
[✓] Port 3100 is available
[✓] Node.js already installed: v20.x.x
[✓] Created user: ibiki
[✓] Installing application to /opt/ibiki-sms...
[✓] Creating environment configuration...
[✓] Setting file permissions...
[✓] Installing dependencies...
[✓] Building application...
[✓] Building backend server...
[✓] Build successful!
[✓] Installing PM2...
[✓] Starting application with PM2...
[✓] Configuring Nginx...

=================================
Deployment Complete!
=================================
```

---

## **PART 4: VERIFY DEPLOYMENT**

### **Step 1: Check PM2 Status**

```bash
pm2 list
```

**Expected output:**
```
┌────┬──────────────┬─────────┬─────────┬──────────┐
│ id │ name         │ status  │ restart │ uptime   │
├────┼──────────────┼─────────┼─────────┼──────────┤
│ 0  │ ibiki-dash   │ online  │ 0       │ 5d       │  ← Your existing service
│ 1  │ ibiki-sms    │ online  │ 0       │ 1m       │  ← New service ✅
└────┴──────────────┴─────────┴─────────┴──────────┘
```

**Status should be "online"**

### **Step 2: Test Application Locally**

```bash
# Test if server responds
curl http://localhost:3100

# Should return HTML (the landing page)
```

### **Step 3: Check Logs**

```bash
# View real-time logs
pm2 logs ibiki-sms

# Should show:
# Server running on http://0.0.0.0:3100
```

### **Step 4: Test from Browser**

**Without Domain:**
```
http://151.243.109.79:3100
```

**With Domain (after DNS setup):**
```
http://sms.yourdomain.com
```

You should see the **Ibiki SMS landing page** with logo and "Get Started" button.

---

## **PART 5: CONFIGURE DNS (If Using Domain)**

### **In Your DNS Provider (Cloudflare, GoDaddy, etc.):**

1. **Log in to your domain provider**

2. **Add A Record:**
   - **Type:** A
   - **Name:** sms (for sms.yourdomain.com)
   - **Value:** 151.243.109.79
   - **TTL:** 3600 or Auto

3. **Save changes**

4. **Wait 5-10 minutes** for DNS propagation

5. **Test:** `ping sms.yourdomain.com` should return `151.243.109.79`

---

## **PART 6: SET UP SSL (HTTPS) - RECOMMENDED**

### **Install Certbot**

```bash
# Update packages
sudo apt update

# Install Certbot
sudo apt install certbot python3-certbot-nginx -y
```

### **Get SSL Certificate**

```bash
# Replace with your actual domain
sudo certbot --nginx -d sms.yourdomain.com
```

**Follow prompts:**
1. Enter email address
2. Agree to terms (Y)
3. Share email with EFF (optional - Y or N)
4. Choose option **2** (Redirect HTTP to HTTPS)

**Certbot will:**
- ✅ Create SSL certificate
- ✅ Update Nginx config
- ✅ Enable HTTPS
- ✅ Set up auto-renewal

### **Test HTTPS**

Visit: `https://sms.yourdomain.com`

You should see the 🔒 lock icon!

---

## **PART 7: CREATE ADMIN ACCOUNT**

### **Step 1: Visit Your Application**

Go to:
- `https://sms.yourdomain.com` (with SSL)
- OR `http://151.243.109.79:3100` (without domain)

### **Step 2: Click "Sign Up"**

### **Step 3: Create Account**

Fill in the form:
- **Email:** your@email.com
- **Password:** (create strong password)
- **Confirm Password:** (repeat password)

### **Step 4: SAVE YOUR API KEY!**

After signup, you'll see your API key **ONCE**:
```
ibk_live_xxxxxxxxxxxxxxxxxxxx
```

**Copy and save it immediately!** You won't see it again.

### **Step 5: You're Auto-Admin**

The first user is automatically promoted to admin role!

### **Step 6: Login**

Click "Login" and sign in with your credentials.

---

## **PART 8: CONFIGURE EXTREMESMS**

### **Step 1: Go to Admin Dashboard**

Click **"Admin"** in the navigation menu.

### **Step 2: Go to Configuration Tab**

### **Step 3: Enter ExtremeSMS Settings**

- **ExtremeSMS API Key:** `your_extremesms_api_key`
- **ExtremeSMS Cost per SMS:** `0.01` (what they charge you)
- **Client Rate per SMS:** `0.02` (what you charge clients)
- **Profit Margin:** (calculated automatically: $0.01)

### **Step 4: Save Configuration**

Click **"Save Configuration"**

### **Step 5: Test Connection**

Click **"Test Connection"**

✅ Should show: "Connection successful!"

---

## **✅ DEPLOYMENT COMPLETE!**

Your services are now running:
- 🎯 **Ibiki Dash:** Port 3000 (your existing service)
- 📱 **Ibiki SMS:** Port 3100 (new SMS API)

---

## **🔧 MANAGEMENT COMMANDS**

### **View All Services**
```bash
pm2 list
```

### **View Logs**
```bash
# Real-time logs
pm2 logs ibiki-sms

# Last 100 lines
pm2 logs ibiki-sms --lines 100

# All services
pm2 logs
```

### **Restart Service**
```bash
pm2 restart ibiki-sms
```

### **Stop Service**
```bash
pm2 stop ibiki-sms
```

### **Start Service**
```bash
pm2 start ibiki-sms
```

### **Monitor Resources**
```bash
pm2 monit
```

### **View Status**
```bash
pm2 status
```

---

## **📁 IMPORTANT FILE LOCATIONS**

- **Application:** `/opt/ibiki-sms/`
- **Config:** `/opt/ibiki-sms/.env`
- **Logs:** `/var/log/ibiki-sms/`
- **Nginx:** `/etc/nginx/sites-available/ibiki-sms`
- **PM2 Config:** `/opt/ibiki-sms/ecosystem.config.cjs`

---

## **🔍 TROUBLESHOOTING**

### **Application Status is "errored"**

```bash
# Check logs for errors
pm2 logs ibiki-sms --lines 50

# Common fixes:
# 1. Check .env file exists
ls -la /opt/ibiki-sms/.env

# 2. Check permissions
sudo chown -R ibiki:ibiki /opt/ibiki-sms

# 3. Restart
pm2 restart ibiki-sms
```

### **Port Already in Use**

```bash
# Find what's using port 3100
sudo ss -ltnp | grep :3100

# Use different port
cd /root/ibiki-sms
export APP_PORT=3200
sudo ./deploy.sh
```

### **Can't Access via Browser**

```bash
# Check firewall
sudo ufw status

# Allow port (if firewall is active)
sudo ufw allow 3100/tcp
sudo ufw allow 'Nginx Full'

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

### **Build Failed**

```bash
# Try manual build
cd /opt/ibiki-sms
sudo -u ibiki npm ci
sudo -u ibiki npm run build:frontend
sudo -u ibiki npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --external:vite --external:@vitejs/* --external:@replit/* --outdir=dist

# Check if build succeeded
ls -lh dist/index.js

# Restart
pm2 restart ibiki-sms
```

### **Services Don't Start After Reboot**

```bash
# Configure PM2 startup
pm2 startup

# Copy and run the command it gives you

# Save processes
pm2 save

# Verify
pm2 list
```

---

## **🎉 SUCCESS!**

You now have:
1. ✅ Ibiki SMS running on your server
2. ✅ SSL/HTTPS configured (if using domain)
3. ✅ Admin account created
4. ✅ ExtremeSMS configured
5. ✅ Both services managed by PM2

**Start adding clients and processing SMS!**

---

## **📞 QUICK REFERENCE**

```bash
# Service management
pm2 list                    # View all services
pm2 logs ibiki-sms          # View logs
pm2 restart ibiki-sms       # Restart service
pm2 monit                   # Monitor resources

# Nginx
sudo nginx -t               # Test config
sudo systemctl reload nginx # Reload Nginx

# Files
nano /opt/ibiki-sms/.env    # Edit config
tail -f /var/log/ibiki-sms/error.log  # View errors

# SSL renewal (automatic, but manual if needed)
sudo certbot renew          # Renew certificates
```

---

**Need Help?** Check logs first: `pm2 logs ibiki-sms`
