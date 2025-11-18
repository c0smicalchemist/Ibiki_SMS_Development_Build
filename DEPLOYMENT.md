# Ibiki SMS - Deployment Guide

Complete deployment guide for installing Ibiki SMS on your server at 151.243.109.79

## Prerequisites

- Ubuntu/Debian Linux server (20.04 or later recommended)
- Root or sudo access
- Minimum 1GB RAM
- Domain name pointing to your server (e.g., api.ibikisms.com)

## Quick Start (1-Click Deployment)

### Step 1: Prepare Your Files

1. Download/clone the Ibiki SMS codebase to your local machine
2. Upload the entire folder to your server:

```bash
scp -r ibiki-sms root@151.243.109.79:/root/
```

Or use an FTP client like FileZilla to upload the folder.

### Step 2: Run the Deployment Script

SSH into your server and run:

```bash
cd /root/ibiki-sms
chmod +x deploy.sh
sudo ./deploy.sh
```

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

### Step 4: Set Up SSL (Optional but Recommended)

Install Certbot and get a free SSL certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.ibikisms.com
```

Follow the prompts to complete SSL setup.

### Step 5: Configure ExtremeSMS

1. Navigate to `http://api.ibikisms.com/admin`
2. Log in with admin credentials (create admin account first)
3. Go to "Configuration" tab
4. Enter your ExtremeSMS API key
5. Set your pricing:
   - ExtremeSMS Cost: What ExtremeSMS charges you (e.g., $0.01)
   - Client Rate: What you charge your clients (e.g., $0.02)
6. Click "Save Configuration"
7. Click "Test Connection" to verify it works

## Installation Directory Structure

```
/opt/ibiki-sms/
├── client/               # Frontend source
├── server/               # Backend source
├── shared/               # Shared types
├── dist/                 # Built application
├── node_modules/         # Dependencies
├── .env                  # Configuration file
└── ecosystem.config.cjs  # PM2 configuration
```

## Environment Variables

Edit `/opt/ibiki-sms/.env` to configure:

```bash
# Security
JWT_SECRET=your-generated-secret

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
pm2 restart ibiki-sms
```

## Accessing the Application

- **Client Portal**: `http://api.ibikisms.com/`
- **Client Dashboard**: `http://api.ibikisms.com/dashboard`
- **API Documentation**: `http://api.ibikisms.com/docs`
- **Admin Dashboard**: `http://api.ibikisms.com/admin`

## Creating Admin Account

The first user to sign up will need to be manually promoted to admin:

1. Sign up at `/signup`
2. SSH into server
3. Access the application data (in-memory for development)
4. Or modify the code to create admin user on first signup

**Recommended**: Create a dedicated signup endpoint for admin in production.

## Managing the Application

### View Application Status
```bash
pm2 status
pm2 info ibiki-sms
```

### View Logs
```bash
pm2 logs ibiki-sms
pm2 logs ibiki-sms --lines 100
```

### Restart Application
```bash
pm2 restart ibiki-sms
```

### Stop Application
```bash
pm2 stop ibiki-sms
```

### Reload Application (Zero Downtime)
```bash
pm2 reload ibiki-sms
```

### Monitor Application
```bash
pm2 monit
```

## Nginx Configuration

Nginx configuration is located at:
```
/etc/nginx/sites-available/ibiki-sms
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
cd /root/ibiki-sms
git pull  # or upload new files
cd /opt/ibiki-sms
sudo -u ibiki npm ci
sudo -u ibiki npm run build
pm2 restart ibiki-sms
```

## Backup and Maintenance

### Backup Environment File
```bash
sudo cp /opt/ibiki-sms/.env /root/ibiki-sms-env-backup
```

### View Application Logs
```bash
tail -f /var/log/ibiki-sms/combined.log
tail -f /var/log/ibiki-sms/error.log
```

### Monitor Disk Usage
```bash
df -h
du -sh /opt/ibiki-sms
```

## Troubleshooting

### Application Won't Start
```bash
# Check logs
pm2 logs ibiki-sms --lines 50

# Check if port is in use
sudo lsof -i :3000

# Verify environment file
cat /opt/ibiki-sms/.env
```

### Nginx 502 Bad Gateway
```bash
# Check if application is running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart ibiki-sms
sudo systemctl restart nginx
```

### Cannot Access from Domain
```bash
# Check DNS resolution
nslookup api.ibikisms.com

# Check firewall
sudo ufw status

# Check Nginx is running
sudo systemctl status nginx
```

### ExtremeSMS API Not Working
1. Verify API key in admin panel
2. Check /var/log/ibiki-sms/error.log for API errors
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
   sudo chmod 600 /opt/ibiki-sms/.env
   ```

## Running Multiple Services

If you're running other services on the same server:

1. Use different ports (edit `PORT` in .env)
2. Create separate Nginx server blocks
3. Each service should have its own PM2 app name
4. Consider using subdomains:
   - `api.ibikisms.com` - Ibiki SMS
   - `other.domain.com` - Other service

## Performance Optimization

For high-traffic scenarios:

1. **Increase PM2 Instances**:
   Edit `/opt/ibiki-sms/ecosystem.config.cjs`:
   ```javascript
   instances: 'max'  // Use all CPU cores
   ```

2. **Add Caching**: Consider adding Redis for session/data caching

3. **Database Migration**: Move from in-memory to PostgreSQL for persistence

4. **Load Balancing**: Use Nginx load balancing for multiple instances

## Support

For issues or questions:
- Check logs: `pm2 logs ibiki-sms`
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
