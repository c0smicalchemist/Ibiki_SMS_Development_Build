# Ibiki SMS Production Deployment Checklist

## Pre-Deployment Requirements

### System Requirements
- [ ] Linux server with Node.js 20.x or higher
- [ ] PostgreSQL 12+ database server
- [ ] PM2 process manager (`npm install -g pm2`)
- [ ] Nginx (recommended for reverse proxy)
- [ ] SSL certificate for HTTPS

### Environment Setup
- [ ] Create production database
- [ ] Configure database user with appropriate permissions
- [ ] Set up environment variables (see .env.example)
- [ ] Configure firewall rules (ports 80, 443, and your app port)

## Deployment Steps

### 1. Server Preparation
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Create application directory
sudo mkdir -p /var/www/ibiki-sms
sudo chown $USER:$USER /var/www/ibiki-sms
```

### 2. Database Setup
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE ibiki_sms_production;
CREATE USER ibiki_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ibiki_sms_production TO ibiki_user;
\q
```

### 3. Application Deployment
```bash
# Extract application files
cd /var/www/ibiki-sms
tar -xzf /path/to/ibiki-sms-production.tar.gz

# Install dependencies
npm install --production

# Create production environment file
cp .env.example .env
# Edit .env with production values

# Build application
npm run build

# Run database migrations
npm run db:migrate
```

### 4. Process Management
```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by the command above
```

### 5. Reverse Proxy Setup (Nginx)
```nginx
# /etc/nginx/sites-available/ibiki-sms
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
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

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Post-Deployment Verification

### Health Checks
- [ ] Application starts without errors: `pm2 status`
- [ ] Database connection works: `curl http://localhost:5000/api/health`
- [ ] Web interface loads: `curl http://your-domain.com`
- [ ] API endpoints respond correctly
- [ ] User registration/login works
- [ ] SMS functionality works (if configured)

### Security Checks
- [ ] Environment variables are properly set
- [ ] Database credentials are secure
- [ ] API keys are configured
- [ ] HTTPS is enabled
- [ ] Firewall rules are configured
- [ ] File permissions are correct

### Monitoring Setup
- [ ] PM2 monitoring: `pm2 monit`
- [ ] Log rotation configured
- [ ] Backup strategy implemented
- [ ] Health monitoring alerts set up

## Environment Variables

Required environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://ibiki_user:password@localhost:5432/ibiki_sms_production

# Security
SESSION_SECRET=your-very-secure-session-secret-here
JWT_SECRET=your-very-secure-jwt-secret-here

# Email (for password reset)
RESEND_API_KEY=your-resend-api-key

# SMS Provider (ExtremeSMS)
EXTREMESMS_API_KEY=your-extremesms-api-key
EXTREMESMS_SENDER_ID=your-sender-id

# Application
NODE_ENV=production
PORT=5000
```

## Troubleshooting

### Common Issues
1. **Database connection fails**: Check DATABASE_URL and PostgreSQL service
2. **Application won't start**: Check Node.js version and dependencies
3. **API returns HTML instead of JSON**: Check route registration and middleware
4. **SMS not sending**: Verify ExtremeSMS API credentials

### Useful Commands
```bash
# Check application logs
pm2 logs ibiki-sms

# Restart application
pm2 restart ibiki-sms

# Check database connection
psql $DATABASE_URL -c "SELECT version();"

# Test API endpoints
curl -X GET http://localhost:5000/api/health
```

## Maintenance

### Regular Tasks
- [ ] Monitor application logs
- [ ] Check database performance
- [ ] Update dependencies (security patches)
- [ ] Backup database regularly
- [ ] Monitor disk space and memory usage

### Updates
```bash
# Stop application
pm2 stop ibiki-sms

# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Deploy new version
# ... deployment steps ...

# Start application
pm2 start ibiki-sms
```