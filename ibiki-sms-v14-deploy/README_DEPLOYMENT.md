# 🚀 Ibiki SMS - Quick Deployment

## **JUST 4 COMMANDS - THAT'S IT!**

```bash
# 1. Upload ZIP to server
scp ibiki-sms.zip root@151.243.109.79:/root/

# 2. SSH into server
ssh root@151.243.109.79

# 3. Extract and enter folder
cd /root && unzip ibiki-sms.zip && cd ibiki-sms

# 4. Deploy!
chmod +x deploy.sh && sudo ./deploy.sh
```

**Done!** Visit: `http://151.243.109.79` (no port needed!)

---

## 📖 **Need Detailed Guide?**

Read: **`DEPLOY_GUIDE.md`** - Complete step-by-step instructions

---

## ✅ **What Gets Deployed:**

- Internal Port: **6000** (app runs here)
- External Access: **Port 80** via Nginx (http://IP_ADDRESS)
- Location: `/opt/ibiki-sms/`
- User: `ibiki`
- Process Manager: PM2
- Web Server: Nginx reverse proxy

---

## 🆘 **If You See Errors:**

### **"package.json not found"**
You forgot to extract the ZIP or enter the folder:
```bash
cd /root
unzip ibiki-sms.zip
cd ibiki-sms  # or cd IbikiGateway
sudo ./deploy.sh
```

### **"Port 6000 already in use"**
Use a different port:
```bash
export APP_PORT=6100
sudo ./deploy.sh
```

### **"Build failed"**
Check logs:
```bash
pm2 logs ibiki-sms
```

---

## 📞 **After Deployment:**

```bash
pm2 list          # Check status
pm2 logs ibiki-sms    # View logs
pm2 restart ibiki-sms # Restart
```

---

**Complete guide:** DEPLOY_GUIDE.md
