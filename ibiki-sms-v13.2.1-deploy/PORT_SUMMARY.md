# ✅ Port Configuration Summary

## 🎯 **NEW DEFAULT SETTINGS**

### **Port Configuration:**
- **Internal Port:** 6000 (app runs here)
- **External Port:** 80 (Nginx listens here)
- **Access:** http://YOUR_IP (no port number needed!)

### **Why Port 6000?**
- ✅ Avoids conflict with common ports (3000, 3100, 5000)
- ✅ Clean URL access via Nginx reverse proxy
- ✅ Better security (app not directly exposed)
- ✅ SSL-ready for HTTPS

---

## 🌐 **How to Access:**

**Primary (via Nginx):**
```
http://151.243.109.79
```

**Direct (bypass Nginx):**
```
http://151.243.109.79:6000
```

---

## 🔧 **How It Works:**

```
Internet → Port 80 (Nginx) → Port 6000 (Ibiki SMS)
```

1. User visits http://151.243.109.79
2. Nginx receives request on port 80
3. Nginx forwards to app on port 6000
4. App responds
5. Nginx sends response to user

**Clean, simple, professional!**

---

## 🔥 **Firewall Configuration:**

If you have a firewall, only open port 80 (and 443 for SSL):

```bash
# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS (for future SSL)
sudo ufw allow 443/tcp

# Port 6000 stays INTERNAL ONLY (more secure!)
```

---

## 📊 **Multi-Service Setup:**

```
Server: 151.243.109.79
├── Ibiki Dash → Port 3000 (your existing service)
└── Ibiki SMS  → Port 6000 (internal)
                 Port 80 (external via Nginx)
```

Both services run independently with no conflicts!

---

## 🔒 **Add SSL Later (HTTPS):**

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d sms.yourdomain.com

# Automatically configures HTTPS on port 443
# Redirects HTTP (80) → HTTPS (443)
```

After SSL:
```
http://sms.yourdomain.com  → https://sms.yourdomain.com
                              (auto-redirect)
```

---

## ⚙️ **Custom Port (If Needed):**

```bash
# Before deploying, set custom port
export APP_PORT=7000
sudo ./deploy.sh

# Nginx will automatically proxy:
# Port 80 → Port 7000
```

---

## ✅ **Benefits of This Setup:**

1. **Clean URLs** - No port numbers in address
2. **Secure** - App not directly exposed to internet
3. **Flexible** - Easy to add SSL/HTTPS
4. **Professional** - Industry standard setup
5. **Scalable** - Easy to add more services
6. **Load Balancing Ready** - Can add multiple app instances

---

**This is production-ready configuration!** 🚀
