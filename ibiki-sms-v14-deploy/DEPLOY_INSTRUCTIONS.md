# Ibiki SMS - Deployment Instructions for Server 151.243.109.79

## 📦 Deployment Package Contents

You need ALL files from this project folder:
- ✅ `/client/` - Frontend application
- ✅ `/server/` - Backend application
- ✅ `/shared/` - Shared types and schemas
- ✅ `package.json` - Dependencies
- ✅ `deploy.sh` - Automated deployment script
- ✅ All config files (vite.config.ts, tsconfig.json, etc.)

---

## 🚀 Step-by-Step Deployment

### **Step 1: Prepare Your Files**

**Option A: Download as ZIP**
1. Download all project files as a ZIP
2. Extract to a folder named `ibiki-sms`

**Option B: Clone from Git** (if using version control)
```bash
git clone <your-repo-url> ibiki-sms
```

---

### **Step 2: Upload to Your Server**

**Using SCP (Command Line):**
```bash
# From your local machine
scp -r ibiki-sms root@151.243.109.79:/root/
```

**Using FileZilla or WinSCP (GUI):**
1. Connect to: `151.243.109.79`
2. Username: `root`
3. Upload the entire `ibiki-sms` folder to `/root/`

---

### **Step 3: SSH into Your Server**

```bash
ssh root@151.243.109.79
```

Enter your root password when prompted.

---

### **Step 4: Configure Deployment**

Since you already have Ibiki Dash running, deploy Ibiki SMS with custom settings:

```bash
cd /root/ibiki-sms
chmod +x deploy.sh
```

**Set your configuration:**
```bash
# Example: Deploy on port 3100 with subdomain sms.yourdomain.com
export APP_PORT=3100
export DOMAIN=sms.yourdomain.com

# Or use a different port if 3100 is taken
# export APP_PORT=3200
```

**Check available ports:**
```bash
# See what ports are in use
ss -ltnp | grep LISTEN

# Port 3000 is likely Ibiki Dash
# Port 3100 should be free for Ibiki SMS
```

---

### **Step 5: Run Deployment Script**

```bash
sudo ./deploy.sh
```

**What this script does:**
1. ✅ Installs Node.js 20 (if not present)
2. ✅ Checks if port 3100 is available
3. ✅ Creates `ibiki` user
4. ✅ Installs app to `/opt/ibiki-sms/`
5. ✅ Builds the application
6. ✅ Installs PM2 (if not present)
7. ✅ Creates PM2 process `ibiki-sms`
8. ✅ Configures Nginx reverse proxy
9. ✅ Starts the application

**Deployment takes about 5-10 minutes.**

---

### **Step 6: Verify Deployment**

Check if both services are running:

```bash
pm2 list
```

**You should see:**
```
┌────┬──────────────┬─────────┬─────────┬──────────┐
│ id │ name         │ status  │ restart │ cpu      │
├────┼──────────────┼─────────┼─────────┼──────────┤
│ 0  │ ibiki-dash   │ online  │ 0       │ 0%       │  ← Your existing service
│ 1  │ ibiki-sms    │ online  │ 0       │ 0%       │  ← New SMS service
└────┴──────────────┴─────────┴─────────┴──────────┘
```

**Test the application:**
```bash
# Test Ibiki SMS directly
curl http://localhost:3100

# Should return the frontend HTML
```

---

### **Step 7: Configure DNS**

Point your subdomain to the server:

**DNS Settings:**
```
Type: A Record
Name: sms (for sms.yourdomain.com)
Value: 151.243.109.79
TTL: 3600
```

Wait 5-10 minutes for DNS propagation.

---

### **Step 8: Set Up SSL (Recommended)**

```bash
# Install Certbot if not already installed
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate for your subdomain
sudo certbot --nginx -d sms.yourdomain.com

# Follow the prompts:
# - Enter your email
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)
```

**Certbot automatically:**
- Creates SSL certificate
- Updates Nginx configuration
- Sets up auto-renewal

---

### **Step 9: Create Admin Account**

1. **Visit your domain:**
   - `https://sms.yourdomain.com` (with SSL)
   - Or `http://151.243.109.79:3100` (without domain)

2. **Click "Sign Up"**

3. **Create your account:**
   - Email: your@email.com
   - Password: (secure password)
   - Confirm password

4. **Save your API key!** (shown only once)

5. **You're automatically admin** (first user is auto-promoted)

---

### **Step 10: Configure ExtremeSMS**

1. **Login to Ibiki SMS**

2. **Navigate to Admin Dashboard**

3. **Go to Configuration tab**

4. **Enter your settings:**
   - ExtremeSMS API Key: `your_extremesms_key`
   - ExtremeSMS Cost: `0.01` (what they charge you)
   - Client Rate: `0.02` (what you charge clients)

5. **Click "Save Configuration"**

6. **Click "Test Connection"** to verify

---

## ✅ Deployment Complete!

**Your Services:**
- 🎯 **Ibiki Dash**: `http://yourdomain.com` (port 3000)
- 📱 **Ibiki SMS**: `https://sms.yourdomain.com` (port 3100)

---

## 🔧 Managing Your Services

### View All Services
```bash
pm2 list
```

### View Logs
```bash
# Ibiki SMS logs
pm2 logs ibiki-sms

# Ibiki Dash logs (your existing service)
pm2 logs ibiki-dash

# All logs
pm2 logs
```

### Restart Services
```bash
# Restart Ibiki SMS only
pm2 restart ibiki-sms

# Restart Ibiki Dash only
pm2 restart ibiki-dash

# Restart all services
pm2 restart all
```

### Stop Services
```bash
pm2 stop ibiki-sms
pm2 stop ibiki-dash
```

### Monitor Performance
```bash
pm2 monit
```

### Check Status
```bash
pm2 status
```

---

## 🔍 Troubleshooting

### Port Already in Use

```bash
# Find what's using port 3100
sudo ss -ltnp | grep :3100

# Use different port
export APP_PORT=3200
sudo ./deploy.sh
```

### Deployment Failed

```bash
# Check logs
cd /root/ibiki-sms
cat /tmp/deploy.log

# Common fixes:
sudo apt update
sudo apt upgrade -y
```

### Can't Access Website

```bash
# Check Nginx
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx

# Check firewall
sudo ufw status
sudo ufw allow 'Nginx Full'
```

### Application Not Starting

```bash
# Check PM2 logs
pm2 logs ibiki-sms --lines 50

# Check if port is available
sudo ss -ltnp | grep :3100

# Restart manually
cd /opt/ibiki-sms
pm2 restart ibiki-sms
```

### Both Services Down After Reboot

```bash
# Check PM2 startup is configured
pm2 startup
# Run the command it gives you

# Save all processes
pm2 save

# List to verify
pm2 list
```

---

## 📂 File Locations

- **Application**: `/opt/ibiki-sms/`
- **Environment**: `/opt/ibiki-sms/.env`
- **Logs**: `/var/log/ibiki-sms/`
- **Nginx Config**: `/etc/nginx/sites-available/ibiki-sms`
- **PM2 Config**: `/opt/ibiki-sms/ecosystem.config.cjs`

---

## 🔐 Security Checklist

- [ ] SSL certificate installed (HTTPS)
- [ ] Strong admin password set
- [ ] ExtremeSMS API key configured
- [ ] Firewall enabled (`sudo ufw enable`)
- [ ] Only ports 22, 80, 443 open to public
- [ ] PM2 startup configured for auto-restart
- [ ] Regular backups of `.env` file

---

## 📞 Support

**Check logs first:**
```bash
pm2 logs ibiki-sms
tail -f /var/log/ibiki-sms/error.log
sudo tail -f /var/log/nginx/error.log
```

**Verify configuration:**
```bash
sudo nginx -t
pm2 status
cat /opt/ibiki-sms/.env
```

---

## 🎉 Success!

You now have:
1. ✅ Ibiki Dash running (your existing service)
2. ✅ Ibiki SMS running (new SMS API)
3. ✅ Both services managed by PM2
4. ✅ SSL/HTTPS configured
5. ✅ Admin account created
6. ✅ ExtremeSMS connected

**Start adding clients and processing SMS messages!**

---

## Quick Reference Commands

```bash
# Check both services
pm2 list

# View SMS service logs
pm2 logs ibiki-sms

# Restart SMS service
pm2 restart ibiki-sms

# Monitor resources
pm2 monit

# Check Nginx
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# View application directory
ls -la /opt/ibiki-sms/

# Edit environment variables
sudo nano /opt/ibiki-sms/.env
# Then restart: pm2 restart ibiki-sms
```
