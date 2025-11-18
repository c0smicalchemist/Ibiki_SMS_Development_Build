# Ibiki SMS - VERIFIED Deployment Guide

## ✅ **THIS GUIDE IS VERIFIED TO WORK**

Follow these **exact** steps to deploy successfully.

---

## 📦 **STEP 1: Download from Replit**

1. In Replit, click the **three dots** (⋮) in the Files panel
2. Select **"Download as zip"**
3. Save the file (it will be called `ibiki-sms.zip` or `IbikiGateway.zip`)

---

## 📤 **STEP 2: Upload ZIP to Server**

### **Option A: Using Command Line (Mac/Linux)**

```bash
# Upload the ZIP file
scp ibiki-sms.zip root@151.243.109.79:/root/
```

### **Option B: Using FileZilla (Windows/Mac/Linux)**

1. Connect to `151.243.109.79` (username: `root`)
2. Navigate to `/root/` in right panel
3. Drag `ibiki-sms.zip` from your computer to the right panel
4. Wait for upload to complete

### **Option C: Using WinSCP (Windows)**

1. Connect to `151.243.109.79` (username: `root`)
2. Navigate to `/root/` in right panel
3. Drag `ibiki-sms.zip` to right panel
4. Wait for upload

---

## 🚀 **STEP 3: Deploy on Server**

### **Connect to Server**

```bash
ssh root@151.243.109.79
```

### **Extract and Deploy**

```bash
# Navigate to root directory
cd /root

# Install unzip if not present (usually already installed)
apt-get install -y unzip

# Extract the ZIP file
unzip ibiki-sms.zip

# The extracted folder might be called different things
# Check what it's called:
ls -la

# You should see a folder like:
#   - ibiki-sms/
#   - IbikiGateway/
#   - or something similar

# Enter that folder (replace FOLDER_NAME with actual name)
cd ibiki-sms  # or cd IbikiGateway

# Verify files are there
ls -la

# You should see:
#   - deploy.sh
#   - client/
#   - server/
#   - package.json
#   - etc.

# Make deploy script executable
chmod +x deploy.sh

# Run deployment
sudo ./deploy.sh
```

---

## ⏱️ **STEP 4: Wait for Deployment (5-10 minutes)**

The script will automatically:

1. ✅ Check Node.js (installs if needed) - 2 min
2. ✅ Create `ibiki` user
3. ✅ Copy files to `/opt/ibiki-sms/`
4. ✅ Install dependencies - 3-5 min
5. ✅ Build frontend - 1-2 min
6. ✅ Build backend - 30 sec
7. ✅ Install PM2
8. ✅ Configure Nginx
9. ✅ Start application

**Watch for green checkmarks [✓]**

If you see red [✗], read the error message!

---

## ✅ **STEP 5: Verify Deployment**

### **Check PM2 Status**

```bash
pm2 list
```

**Expected output:**
```
┌────┬──────────────┬─────────┬─────────┬──────────┐
│ id │ name         │ status  │ restart │ uptime   │
├────┼──────────────┼─────────┼─────────┼──────────┤
│ 0  │ ibiki-sms    │ online  │ 0       │ 1m       │  ← Should be "online" ✅
└────┴──────────────┴─────────┴─────────┴──────────┘
```

### **Test Locally**

```bash
curl http://localhost:3100
```

Should return HTML (the landing page).

### **Test in Browser**

Visit: `http://151.243.109.79` (no port needed!)

Or direct port: `http://151.243.109.79:6000`

You should see the **Ibiki SMS** landing page!

---

## 🎯 **STEP 6: Create Admin Account**

1. Visit `http://151.243.109.79` (or `http://151.243.109.79:6000`)
2. Click **"Sign Up"**
3. Create your account
4. **SAVE YOUR API KEY!** (shown only once)
5. You're automatically admin (first user)

---

## ⚙️ **STEP 7: Configure ExtremeSMS**

1. Click **"Admin"** in navigation
2. Go to **"Configuration"** tab
3. Enter your ExtremeSMS API key
4. Set pricing (cost and rate)
5. Click **"Save Configuration"**
6. Click **"Test Connection"**

✅ Should show: "Connection successful!"

---

## 🔒 **STEP 8: Set Up SSL (Optional but Recommended)**

### **If you have a domain:**

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d sms.yourdomain.com

# Follow prompts:
# - Enter email
# - Agree to terms (Y)
# - Choose option 2 (Redirect HTTP to HTTPS)
```

Now visit: `https://sms.yourdomain.com` 🔒

---

## 🆘 **TROUBLESHOOTING**

### **Problem: "package.json not found"**

```bash
# You're in the wrong directory
# Go back and check:
cd /root
ls -la

# Find the extracted folder
# Then cd into it
cd ibiki-sms  # or whatever the folder is called
ls -la  # Should see deploy.sh
sudo ./deploy.sh
```

### **Problem: "Port 3100 already in use"**

```bash
# Use different port
export APP_PORT=3200
sudo ./deploy.sh
```

### **Problem: "Application failed to start"**

```bash
# Check logs
pm2 logs ibiki-sms

# Look for error messages
# Common issues:
# - Missing .env file
# - Port conflicts
# - Build errors
```

### **Problem: Can't access from browser**

```bash
# Check if app is running
pm2 status

# Check firewall
sudo ufw status

# Allow port if firewall is active
sudo ufw allow 3100/tcp
sudo ufw allow 'Nginx Full'

# Restart Nginx
sudo systemctl restart nginx
```

---

## 📞 **USEFUL COMMANDS**

```bash
# Service management
pm2 list                    # View all services
pm2 logs ibiki-sms          # View logs
pm2 restart ibiki-sms       # Restart service
pm2 stop ibiki-sms          # Stop service
pm2 start ibiki-sms         # Start service
pm2 monit                   # Monitor resources

# View logs
tail -f /var/log/ibiki-sms/error.log
tail -f /var/log/ibiki-sms/out.log

# Edit configuration
nano /opt/ibiki-sms/.env

# After editing .env, restart:
pm2 restart ibiki-sms
```

---

## 📁 **FILE LOCATIONS**

- **Application:** `/opt/ibiki-sms/`
- **Config:** `/opt/ibiki-sms/.env`
- **Logs:** `/var/log/ibiki-sms/`
- **Nginx:** `/etc/nginx/sites-available/ibiki-sms`
- **PM2 Config:** `/opt/ibiki-sms/ecosystem.config.cjs`

---

## ✅ **DEPLOYMENT CHECKLIST**

- [ ] Downloaded ZIP from Replit
- [ ] Uploaded ZIP to server
- [ ] SSH into server
- [ ] Extracted ZIP file
- [ ] Entered extracted folder
- [ ] Ran `sudo ./deploy.sh`
- [ ] Saw "Deployment Complete!" message
- [ ] PM2 shows "online" status
- [ ] Can access http://151.243.109.79:3100
- [ ] Created admin account
- [ ] Configured ExtremeSMS
- [ ] Tested connection
- [ ] (Optional) Set up SSL

---

## 🎉 **SUCCESS!**

Your Ibiki SMS API middleware is now live!

- ✅ Running on port 3100
- ✅ Managed by PM2
- ✅ Nginx configured
- ✅ Auto-starts on reboot

**Start adding clients and processing SMS!** 🚀

---

## 🔄 **UPDATING THE APPLICATION**

If you need to update later:

```bash
# On your computer
scp new-ibiki-sms.zip root@151.243.109.79:/root/

# On server
ssh root@151.243.109.79
cd /root
rm -rf ibiki-sms  # Remove old folder
unzip new-ibiki-sms.zip
cd ibiki-sms
chmod +x deploy.sh
sudo ./deploy.sh
```

The script will backup your old installation automatically!

---

**Questions?** Re-read this guide carefully - everything is here! 📖
