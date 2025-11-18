# Ibiki SMS - Quick Clean Deployment (3 Steps)

## 🚀 Fast Track Deployment

For experienced users who want to deploy quickly.

---

## **STEP 1: Upload to Server**

```bash
# From your computer (in extracted folder - name doesn't matter!)
# Could be "IbikiGateway", "ibiki-sms", or any other name
scp -r . root@151.243.109.79:/root/deploy-temp/
```

---

## **STEP 2: SSH and Deploy**

```bash
# Connect to server
ssh root@151.243.109.79

# Navigate to upload folder
cd /root/deploy-temp

# Make script executable and deploy (default: port 3100)
chmod +x deploy.sh
sudo ./deploy.sh
```

**Or with custom settings:**
```bash
export APP_PORT=3100
export DOMAIN=sms.yourdomain.com
sudo ./deploy.sh
```

---

## **STEP 3: Verify**

```bash
# Check status
pm2 list

# Test
curl http://localhost:3100

# View in browser
http://151.243.109.79:3100
```

---

## **✅ Done!**

- Create admin account at signup page
- Configure ExtremeSMS in Admin Dashboard
- Optional: Set up SSL with `sudo certbot --nginx -d sms.yourdomain.com`

---

## **Useful Commands**

```bash
pm2 logs ibiki-sms      # View logs
pm2 restart ibiki-sms   # Restart
pm2 monit               # Monitor
```

---

**For detailed instructions, see:** `CLEAN_DEPLOYMENT.md`
