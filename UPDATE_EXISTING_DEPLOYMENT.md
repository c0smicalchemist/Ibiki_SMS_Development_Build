# Update Existing Deployment to Port 6000 with Nginx

## 🔄 **For Current Deployment on Server**

If you already deployed and want to update to port 6000 with Nginx reverse proxy:

```bash
# SSH into server
ssh root@151.243.109.79

# Go to installation directory
cd /opt/ibiki-sms

# Stop current service
pm2 stop ibiki-sms

# Update .env file to use port 6000
sed -i 's/PORT=3100/PORT=6000/g' .env

# Or edit manually
nano .env
# Change: PORT=6000

# Create Nginx configuration
cat > /etc/nginx/sites-available/ibiki-sms << 'EOF'
server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 10M;

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://127.0.0.1:6000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/ibiki-sms

# Remove default Nginx site
rm -f /etc/nginx/sites-enabled/default

# Test Nginx config
nginx -t

# Reload Nginx
systemctl reload nginx

# Restart app
pm2 restart ibiki-sms

# Check status
pm2 status
```

---

## ✅ **Verify It's Working**

```bash
# Test locally
curl http://localhost:6000

# Test via Nginx
curl http://localhost

# Check Nginx is running
systemctl status nginx
```

---

## 🌐 **Access Your Application**

**Before:** http://151.243.109.79:3100  
**After:** http://151.243.109.79 (no port needed!)

---

## 🔥 **Firewall (If Needed)**

If you have a firewall, allow HTTP:

```bash
# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS (for later SSL)
ufw allow 443/tcp

# Check status
ufw status
```

---

## 📝 **What Changed:**

1. ✅ App runs on port 6000 (internal)
2. ✅ Nginx listens on port 80 (external)
3. ✅ Nginx proxies to app on port 6000
4. ✅ Access via IP without port number
5. ✅ Ready for SSL/HTTPS later

---

## 🔒 **Add SSL Later (Optional)**

```bash
# Install Certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate (if you have a domain)
certbot --nginx -d yourdomain.com

# Auto-renew setup
certbot renew --dry-run
```

---

**Now access your app at:** http://151.243.109.79 🚀
