# Ibiki SMS - Quick Deployment Guide

## 🚀 Deploy to Your Linux Server in 2 Steps

### Prerequisites
- Linux server (Ubuntu/Debian) at **151.243.109.79**
- Root access
- ExtremeSMS API key

---

## Step 1: Upload Files to /root

Upload the deployment package to your server:

```bash
# Extract and upload to server
scp ibiki-sms-deployment.tar.gz root@151.243.109.79:/root/
```

Then SSH into your server and extract:

```bash
ssh root@151.243.109.79
cd /root
mkdir ibiki-sms
tar -xzf ibiki-sms-deployment.tar.gz -C ibiki-sms
cd ibiki-sms
```

---

## Step 2: Run Deployment Script

**Simply run from /root/ibiki-sms:**

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

That's it! The script will build and deploy everything **in place** from `/root/ibiki-sms`.

**Custom configuration?** Use environment variables:
```bash
# Deploy on custom port with domain
APP_PORT=3100 DOMAIN=api.yourdomain.com sudo ./deploy.sh

# Deploy to /opt instead of in-place
DEPLOY_IN_PLACE=false sudo ./deploy.sh
```

The script will automatically:
- ✅ Install Node.js 20
- ✅ Create application user
- ✅ Install dependencies & build app
- ✅ Set up PM2 process manager
- ✅ Configure Nginx reverse proxy
- ✅ Start the application

**Installation completes in ~5 minutes!**

---

## ✅ Access Your Application

**Via IP Address:**
```
http://151.243.109.79
```

**Via Domain (optional):**
1. Point A record to **151.243.109.79**
2. Redeploy: `DOMAIN=api.yourdomain.com sudo ./deploy.sh`
3. Visit: `http://api.yourdomain.com`

---

## 🎯 First Login

1. Go to signup page
2. Create your account with:
   - **Email**: your@email.com
   - **Password**: your secure password
   
3. **Your account will automatically be admin** (first user is always admin!)

4. Save your API key when shown (only displayed once)

---

## ⚙️ Configure ExtremeSMS

After logging in:

1. Navigate to **Admin Dashboard**
2. Go to **Configuration** tab
3. Enter your ExtremeSMS API key
4. Set pricing:
   - **ExtremeSMS Cost**: What ExtremeSMS charges (e.g., $0.01)
   - **Client Rate**: What you charge clients (e.g., $0.02)
5. Click **Save Configuration**
6. Click **Test Connection** to verify

---

## 🔒 Enable HTTPS (Recommended)

Install free SSL certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 📊 Manage Your Application

### View Application Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs yubin-dash
```

### Restart Application
```bash
pm2 restart yubin-dash
```

### Monitor Application
```bash
pm2 monit
```

---

## 📁 Installation Location

**By default, application deploys in place:**
- Location: `/root/ibiki-sms/`
- Config: `/root/ibiki-sms/.env`
- Logs: `/var/log/ibiki-sms/`

**To deploy to /opt instead:**
```bash
DEPLOY_IN_PLACE=false sudo ./deploy.sh
```

---

## 🆘 Troubleshooting

### Application won't start?
```bash
pm2 logs yubin-dash --lines 50
```

### Can't access from browser?
```bash
# Check if app is running
pm2 status

# Check Nginx
sudo systemctl status nginx

# Check firewall
sudo ufw status
```

### Need to restart everything?
```bash
pm2 restart yubin-dash
sudo systemctl restart nginx
```

---

## 🔀 Running with Other Services

If you have another service on the same server:

```bash
# Deploy on different port
APP_PORT=3100 DOMAIN=api.yourdomain.com sudo ./deploy.sh
```

See `MULTI_SERVICE.md` for complete multi-service guide.

## 📚 Full Documentation

- **MULTI_SERVICE.md** - Running alongside other applications
- **DEPLOYMENT.md** - Complete deployment guide
- **README.md** - Full project documentation

---

## ✅ You're All Set!

Your Yubin Dash SMS API middleware is now live! 🎉

Start adding clients and processing SMS messages through ExtremeSMS.
