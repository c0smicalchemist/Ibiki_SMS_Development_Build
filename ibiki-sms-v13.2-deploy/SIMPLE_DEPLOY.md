# Ibiki SMS - Simple Deployment (Works with Any Folder Name)

## 📦 **STEP 1: Download & Extract**

1. Download the ZIP from Replit
2. Extract it on your computer
3. **Don't worry about the folder name** - it can be anything!

---

## 📤 **STEP 2: Upload to Server**

### **Using Command Line:**

```bash
# Replace "FOLDER_NAME" with your actual extracted folder name
# It might be "IbikiGateway", "ibiki-sms", or anything else
cd /path/to/FOLDER_NAME
scp -r . root@151.243.109.79:/root/ibiki-sms-temp/
```

### **Using FileZilla/WinSCP:**

1. Connect to `151.243.109.79` (username: root)
2. Upload the entire extracted folder to `/root/ibiki-sms-temp/`

---

## 🚀 **STEP 3: Deploy**

```bash
# SSH into server
ssh root@151.243.109.79

# Navigate to uploaded folder
cd /root/ibiki-sms-temp

# Make script executable
chmod +x deploy.sh

# Run deployment
sudo ./deploy.sh
```

**That's it!** The script will:
- Create `/opt/ibiki-sms/` directory
- Install all dependencies
- Build the application
- Start on port 3100

---

## ✅ **STEP 4: Verify**

```bash
# Check if running
pm2 list

# Should show "ibiki-sms" as "online"

# Test in browser
http://151.243.109.79:3100
```

---

## 🎯 **Custom Port or Domain?**

```bash
# Before running deploy.sh, set these:
export APP_PORT=3100
export DOMAIN=sms.yourdomain.com
sudo ./deploy.sh
```

---

## 🆘 **Troubleshooting**

### **Script not found:**
```bash
# Check if you're in the right folder
ls -la deploy.sh

# If not there, find it
find /root -name "deploy.sh"
cd /path/to/folder/with/deploy.sh
```

### **Port already in use:**
```bash
# Use different port
export APP_PORT=3200
sudo ./deploy.sh
```

### **Build failed:**
```bash
# Check logs
pm2 logs ibiki-sms --lines 50
```

---

## 📞 **Quick Commands**

```bash
pm2 list                # View all services
pm2 logs ibiki-sms      # View logs
pm2 restart ibiki-sms   # Restart service
pm2 stop ibiki-sms      # Stop service
```

---

## 🎉 **After Deployment**

1. Visit: `http://151.243.109.79:3100`
2. Click "Sign Up" and create account
3. Go to Admin Dashboard
4. Configure ExtremeSMS API key
5. Start using!

---

**Need SSL?**
```bash
sudo certbot --nginx -d sms.yourdomain.com
```
