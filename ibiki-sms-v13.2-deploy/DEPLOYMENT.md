# Yubin Dash - Deployment Guide

Complete deployment guide for installing Yubin Dash SMS API middleware on your Linux server (151.243.109.79)

## Prerequisites

- Ubuntu/Debian Linux server (20.04 or later recommended)
- Root or sudo access
- Minimum 1GB RAM, 2GB recommended
- Domain name pointing to your server (e.g., api.yubindash.com)

## Quick Start (1-Click Deployment)

### Step 1: Prepare Your Files

1. Download/clone the Yubin Dash codebase to your local machine
2. Upload the entire folder to your server:

```bash
scp -r yubin-dash root@151.243.109.79:/root/
```

Or use an FTP client like FileZilla to upload the folder.

### Step 2: Run the Deployment Script

SSH into your server and run:

```bash
cd /root/yubin-dash
chmod +x deploy.sh
sudo ./deploy.sh
```

**If you have other services running on the same server:**
```bash
# Deploy on custom port with subdomain
APP_PORT=3100 DOMAIN=api.yourdomain.com sudo ./deploy.sh
```

See [MULTI_SERVICE.md](./MULTI_SERVICE.md) for complete multi-service deployment guide.

The script will automatically:
- Install Node.js 20
- Create application user
- Install dependencies
- Build the application
- Set up PM2 process manager
- Configure Nginx reverse proxy
- Start the application

### Step 3: Configure Your Domain

Point your domain to your server IP:

```
Type: A Record
Name: api (or @)
Value: 151.243.109.79
TTL: 3600
```

### Step 4: Set Up SSL (Recommended for Production)

Install Certbot and get a free SSL certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yubindash.com
```

Follow the prompts to complete SSL setup. Certbot will automatically configure Nginx for HTTPS.

### Step 5: Create Admin Account

1. Navigate to `http://api.yubindash.com/signup` (or your domain)
2. Create your account with email and password
3. **The first user is automatically promoted to admin!** No manual steps needed.
4. Save your API key when displayed (only shown once)

### Step 6: Configure ExtremeSMS

1. Log in to your admin account
2. Navigate to the Admin Dashboard
3. Go to "Configuration" tab
4. Enter your ExtremeSMS API key
5. Set your pricing:
   - ExtremeSMS Cost: What ExtremeSMS charges you (e.g., $0.01)
   - Client Rate: What you charge your clients (e.g., $0.02)
6. Click "Save Configuration"
7. Click "Test Connection" to verify it works

## Installation Directory Structure

```
/opt/yubin-dash/
├── client/               # Frontend source
├── server/               # Backend source
├── shared/               # Shared types
├── dist/                 # Built application
├── node_modules/         # Dependencies
├── .env                  # Configuration file
└── ecosystem.config.cjs  # PM2 configuration
```

## Environment Variables

Edit `/opt/yubin-dash/.env` to configure:

```bash
# Security
JWT_SECRET=your-generated-secret
SESSION_SECRET=your-generated-secret

# ExtremeSMS
EXTREMESMS_API_KEY=your_key_here

# Pricing
DEFAULT_EXTREME_COST=0.01
DEFAULT_CLIENT_RATE=0.02

# Server
PORT=3000
```

After editing, restart the application:

```bash
pm2 restart yubin-dash
```

## Accessing the Application

- **Landing Page**: `http://api.yubindash.com/`
- **Client Signup**: `http://api.yubindash.com/signup`
- **Client Login**: `http://api.yubindash.com/login`
- **Client Dashboard**: `http://api.yubindash.com/dashboard` (after login)
- **Admin Dashboard**: Access after logging in with admin account

## Creating Admin Account

**The first user to sign up is automatically promoted to admin!**

When you deploy the application for the first time:
1. Navigate to the signup page
2. Create your account with email and password
3. You'll be automatically assigned the admin role
4. All subsequent users will be created as regular clients

**Important Notes:**
- The application uses in-memory storage by default, so data is lost on restart
- For production with persistent data, migrate to PostgreSQL (see section below)
- Admin role grants access to:
  - System configuration (ExtremeSMS API key, pricing)
  - Client management (view all clients, manage credits)
  - Monitoring and analytics
  - Credit transaction history

## Managing the Application

### View Application Status
```bash
pm2 status
pm2 info yubin-dash
```

### View Logs
```bash
pm2 logs yubin-dash
pm2 logs yubin-dash --lines 100
```

### Restart Application
```bash
pm2 restart yubin-dash
```

### Stop Application
```bash
pm2 stop yubin-dash
```

### Reload Application (Zero Downtime)
```bash
pm2 reload yubin-dash
```

### Monitor Application
```bash
pm2 monit
```

## Nginx Configuration

Nginx configuration is located at:
```
/etc/nginx/sites-available/yubin-dash
```

Test configuration:
```bash
sudo nginx -t
```

Reload Nginx:
```bash
sudo systemctl reload nginx
```

## Updating the Application

To update to a new version:

```bash
cd /root/yubin-dash
git pull  # or upload new files
cd /opt/yubin-dash
sudo -u yubin npm ci
sudo -u yubin npm run build
pm2 restart yubin-dash
```

## Backup and Maintenance

### Backup Environment File
```bash
sudo cp /opt/yubin-dash/.env /root/yubin-dash-env-backup
```

### View Application Logs
```bash
tail -f /var/log/yubin-dash/combined.log
tail -f /var/log/yubin-dash/error.log
```

### Monitor Disk Usage
```bash
df -h
du -sh /opt/yubin-dash
```

## Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs yubin-dash --lines 50

# Check if port is in use
sudo lsof -i :3000

# Verify environment file
cat /opt/yubin-dash/.env
```

### Nginx 502 Bad Gateway
```bash
# Check if application is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart yubin-dash
sudo systemctl restart nginx
```

### Cannot Access from Domain
```bash
# Check DNS resolution
nslookup api.yubindash.com

# Check firewall
sudo ufw status

# Check Nginx is running
sudo systemctl status nginx
```

### ExtremeSMS API Not Working
1. Verify API key in admin panel
2. Check /var/log/yubin-dash/error.log for API errors
3. Test connection using "Test Connection" button in admin panel
4. Verify ExtremeSMS account has credits

## Security Recommendations

1. **Change JWT Secret**: Generate a secure random secret
   ```bash
   openssl rand -hex 32
   ```

2. **Enable Firewall**:
   ```bash
   sudo ufw enable
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. **Set Up SSL**: Always use HTTPS in production

4. **Regular Updates**: Keep system and Node.js updated
   ```bash
   sudo apt update && sudo apt upgrade
   ```

5. **Secure .env File**: Ensure proper permissions
   ```bash
   sudo chmod 600 /opt/yubin-dash/.env
   ```

## Running Multiple Services

If you're running other services on the same server:

1. Use different ports (edit `PORT` in .env)
2. Create separate Nginx server blocks
3. Each service should have its own PM2 app name
4. Consider using subdomains:
   - `api.yubindash.com` - Yubin Dash
   - `other.domain.com` - Other service

## Performance Optimization

For high-traffic scenarios:

1. **Increase PM2 Instances**:
   Edit `/opt/yubin-dash/ecosystem.config.cjs`:
   ```javascript
   instances: 'max'  // Use all CPU cores
   ```

2. **Add Caching**: Consider adding Redis for session/data caching

3. **Database Migration**: Move from in-memory to PostgreSQL for persistence

4. **Load Balancing**: Use Nginx load balancing for multiple instances

## Support

For issues or questions:
- Check logs: `pm2 logs yubin-dash`
- Review Nginx logs: `/var/log/nginx/`
- Verify configuration: Check `.env` file

## Migration to PostgreSQL (Future)

The application currently uses in-memory storage. To migrate to PostgreSQL:

1. Install PostgreSQL
2. Create database
3. Update `.env` with `DATABASE_URL`
4. Run migrations (will be provided in future update)
5. Restart application

This ensures data persistence across restarts.
