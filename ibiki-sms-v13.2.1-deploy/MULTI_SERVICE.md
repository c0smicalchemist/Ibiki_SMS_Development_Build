# Running Yubin Dash with Other Services

Guide for deploying Yubin Dash on a server that already has other applications running.

## Overview

Yubin Dash can run alongside other services on the same server without conflicts. This guide covers best practices for multi-service deployment.

---

## Quick Setup for Multi-Service

### Deploy with Custom Port

If you already have a service on port 3000:

```bash
# Deploy Yubin Dash on port 3100
APP_PORT=3100 DOMAIN=yubin.yourdomain.com sudo ./deploy.sh
```

### Deploy with Manual Nginx Configuration

If you manage Nginx yourself:

```bash
# Skip automatic Nginx configuration
SKIP_NGINX=true APP_PORT=3100 sudo ./deploy.sh
```

Then manually add your Nginx server block (see below).

---

## Port Configuration

### Default Ports
- **Yubin Dash default**: 3100 (changed from 3000 to avoid conflicts)
- **Common other services**: 3000, 8080, 5000, etc.

### Check Available Ports

Before deployment, check which ports are in use:

```bash
# List all listening ports
sudo ss -ltnp

# Check specific port
sudo ss -ltnp | grep :3100
```

### Set Custom Port

```bash
# Use environment variable
APP_PORT=3200 sudo ./deploy.sh

# Or edit .env file after deployment
sudo nano /opt/yubin-dash/.env
# Change: PORT=3200
pm2 restart yubin-dash
```

---

## Domain Strategy

### Option 1: Subdomains (Recommended)

Use different subdomains for each service:

```
api.yourdomain.com     → Yubin Dash (port 3100)
app.yourdomain.com     → Other service (port 3000)
www.yourdomain.com     → Main website (port 8080)
```

**DNS Configuration:**
```
Type: A Record
Name: api
Value: 151.243.109.79
TTL: 3600
```

### Option 2: Different Domains

```
yubindash.com          → Yubin Dash
yourapp.com            → Other service
```

### Option 3: Path-Based Routing (Advanced)

Not recommended, but possible:
```
yourdomain.com/sms     → Yubin Dash
yourdomain.com/app     → Other service
```

---

## Nginx Configuration

### Multiple Server Blocks (Recommended)

Each service gets its own Nginx configuration file:

**File: `/etc/nginx/sites-available/yubin-dash`**
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**File: `/etc/nginx/sites-available/other-service`**
```nginx
server {
    listen 80;
    server_name app.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        # ... same proxy settings ...
    }
}
```

### Enable Both Sites

```bash
# Enable Yubin Dash
sudo ln -s /etc/nginx/sites-available/yubin-dash /etc/nginx/sites-enabled/

# Enable other service
sudo ln -s /etc/nginx/sites-available/other-service /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### View All Active Sites

```bash
ls -la /etc/nginx/sites-enabled/
```

---

## PM2 Process Management

### View All Running Processes

```bash
pm2 list
```

Output example:
```
┌────┬─────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id │ name        │ mode        │ ↺      │ status  │ cpu      │
├────┼─────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0  │ other-app   │ fork        │ 15     │ online  │ 0%       │
│ 1  │ yubin-dash  │ fork        │ 0      │ online  │ 0%       │
└────┴─────────────┴─────────────┴─────────┴─────────┴──────────┘
```

### Manage Individual Services

```bash
# Yubin Dash specific
pm2 logs yubin-dash
pm2 restart yubin-dash
pm2 stop yubin-dash
pm2 delete yubin-dash

# Other service specific
pm2 logs other-app
pm2 restart other-app

# All services
pm2 restart all
pm2 logs
```

### Save PM2 Configuration

After starting both services:

```bash
# Save current process list
pm2 save

# Setup startup script (run once)
pm2 startup systemd

# Copy and run the generated command
```

---

## Resource Management

### Monitor Resource Usage

```bash
# PM2 monitoring dashboard
pm2 monit

# System resources
htop

# Disk usage
df -h

# Check each app's memory
pm2 status
```

### Set Memory Limits

Edit `/opt/yubin-dash/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [{
    name: 'yubin-dash',
    script: './dist/index.js',
    max_memory_restart: '500M',  // Restart if exceeds 500MB
    instances: 1,
    // ... other settings
  }]
};
```

Then restart:
```bash
pm2 restart yubin-dash
```

---

## Firewall Configuration

### Allow Multiple Services

```bash
# Allow HTTP and HTTPS (for all services)
sudo ufw allow 'Nginx Full'

# Or individually
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Keep internal ports blocked (only accessible via Nginx)
# Don't expose 3000, 3100, etc. directly
```

### Check Firewall Status

```bash
sudo ufw status verbose
```

---

## SSL/HTTPS Setup

### Multiple Domains with Certbot

```bash
# Install Certbot (if not already installed)
sudo apt install certbot python3-certbot-nginx

# Get certificate for Yubin Dash subdomain
sudo certbot --nginx -d api.yourdomain.com

# Get certificate for other service
sudo certbot --nginx -d app.yourdomain.com

# Certificates auto-renew via cron
```

---

## Deployment Checklist

- [ ] Check available ports with `ss -ltnp`
- [ ] Choose unique port for Yubin Dash (e.g., 3100)
- [ ] Set up DNS for subdomain
- [ ] Deploy with custom port: `APP_PORT=3100 ./deploy.sh`
- [ ] Verify both services running: `pm2 list`
- [ ] Check Nginx configurations: `sudo nginx -t`
- [ ] Test both services via browser
- [ ] Set up SSL for both domains
- [ ] Save PM2 configuration: `pm2 save`
- [ ] Monitor resource usage: `pm2 monit`

---

## Common Scenarios

### Scenario 1: Adding Yubin Dash to Existing Node.js App

```bash
# Deploy Yubin Dash on different port
APP_PORT=3100 DOMAIN=api.yourdomain.com sudo ./deploy.sh

# Both apps will use same PM2, different process names
pm2 list
# Shows: existing-app (port 3000) + yubin-dash (port 3100)
```

### Scenario 2: Multiple Apps, Shared Nginx

```bash
# Deploy without touching Nginx
SKIP_NGINX=true APP_PORT=3100 sudo ./deploy.sh

# Manually create Nginx server block
sudo nano /etc/nginx/sites-available/yubin-dash
# Add your configuration

# Enable and reload
sudo ln -s /etc/nginx/sites-available/yubin-dash /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Scenario 3: Different Users for Each Service

```bash
# Deploy Yubin Dash with custom user
APP_USER=yubin-user APP_PORT=3100 sudo ./deploy.sh

# Each service runs as different Linux user:
# - existing-app runs as: appuser
# - yubin-dash runs as: yubin-user
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find what's using the port
sudo ss -ltnp | grep :3100

# Or
sudo lsof -i :3100

# Kill the process or use different port
APP_PORT=3200 sudo ./deploy.sh
```

### Nginx Conflicts

```bash
# List all enabled sites
ls -la /etc/nginx/sites-enabled/

# Disable conflicting site temporarily
sudo rm /etc/nginx/sites-enabled/conflicting-site

# Test configuration
sudo nginx -t

# Re-enable after fixing
sudo ln -s /etc/nginx/sites-available/conflicting-site /etc/nginx/sites-enabled/
```

### PM2 Conflicts

```bash
# List all processes
pm2 list

# If processes are duplicated, delete and restart
pm2 delete yubin-dash
pm2 start /opt/yubin-dash/ecosystem.config.cjs
pm2 save
```

### Both Services Down After Reboot

```bash
# Check PM2 startup is configured
pm2 startup

# Run the generated command

# Save current processes
pm2 save

# Reboot and verify
sudo reboot
# After reboot:
pm2 list
```

---

## Performance Tips

### 1. Use Different CPU Cores

Edit ecosystem config for clustering:

```javascript
instances: 2,  // Use 2 CPU cores
exec_mode: 'cluster'
```

### 2. Separate Log Files

Each service should have its own log directory:
- `/var/log/yubin-dash/`
- `/var/log/other-app/`

### 3. Nginx Caching

Add caching for better performance:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;

location / {
    proxy_cache my_cache;
    proxy_pass http://127.0.0.1:3100;
}
```

---

## Summary

**Key Points:**
- ✅ Use unique ports for each service (3100, 3000, 8080, etc.)
- ✅ Use subdomains for cleaner separation
- ✅ Each service gets own Nginx server block
- ✅ PM2 manages all services, each with unique name
- ✅ Monitor resources with `pm2 monit`
- ✅ Always test Nginx config: `sudo nginx -t`

**Quick Deploy Command:**
```bash
APP_PORT=3100 DOMAIN=api.yourdomain.com sudo ./deploy.sh
```

Your services will coexist perfectly! 🚀
