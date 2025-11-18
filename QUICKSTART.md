# Yubin Dash - Quick Deployment Guide

## 🚀 Deploy to Your Linux Server in 3 Steps

### Prerequisites
- Linux server (Ubuntu/Debian) at **151.243.109.79**
- Root/sudo access
- Domain name (optional, but recommended)

---

## Step 1: Upload Files to Server

Upload the entire `yubin-dash` folder to your server:

```bash
scp -r yubin-dash root@151.243.109.79:/root/
```

Or use FileZilla/WinSCP to upload via FTP.

---

## Step 2: Run 1-Click Deployment Script

SSH into your server:

```bash
ssh root@151.243.109.79
```

Run the deployment script:

```bash
cd /root/yubin-dash
chmod +x deploy.sh
sudo ./deploy.sh
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

## Step 3: Access Your Application

### If you have a domain:
1. Point your domain to **151.243.109.79** (A Record)
2. Visit: `http://yourdomain.com`

### Without a domain:
Visit: `http://151.243.109.79`

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

Application installed at: `/opt/yubin-dash/`

Environment config: `/opt/yubin-dash/.env`

Logs: `/var/log/yubin-dash/`

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

## 📚 Full Documentation

For detailed information, see `DEPLOYMENT.md`

---

## ✅ You're All Set!

Your Yubin Dash SMS API middleware is now live! 🎉

Start adding clients and processing SMS messages through ExtremeSMS.
