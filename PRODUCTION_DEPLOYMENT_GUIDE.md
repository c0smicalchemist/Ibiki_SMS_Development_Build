# Ibiki SMS Production Deployment Guide

This guide provides comprehensive instructions for deploying the Ibiki SMS application to a production Linux server.

## 🎯 Overview

The Ibiki SMS application is a full-stack web application built with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx (optional)

## 📋 Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / RHEL 8+
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 10GB free space
- **Network**: Internet access for package installation

### Required Software
- Node.js 20.x or higher
- PostgreSQL 12+ 
- PM2 (Process Manager)
- Nginx (recommended for reverse proxy)

## 🚀 Quick Deployment

### Option 1: Automated Deployment Script

1. **Download the application**:
   ```bash
   git clone https://github.com/c0smicalchemist/Ibiki_SMS_Development_Build.git
   cd Ibiki_SMS_Development_Build
   ```

2. **Run the deployment script**:
   ```bash
   sudo ./production-deploy.sh
   ```

3. **Configure environment variables**:
   ```bash
   sudo nano /opt/ibiki-sms/.env
   ```

4. **Restart the application**:
   ```bash
   sudo systemctl restart pm2-ibiki
   ```

### Option 2: Manual Deployment

Follow the detailed steps below for manual deployment.

## 📖 Manual Deployment Steps

### Step 1: System Preparation

1. **Update system packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Install Node.js 20.x**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install PostgreSQL**:
   ```bash
   sudo apt install postgresql postgresql-contrib -y
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

4. **Install PM2 globally**:
   ```bash
   sudo npm install -g pm2
   ```

5. **Install Nginx (optional)**:
   ```bash
   sudo apt install nginx -y
   sudo systemctl start nginx
   sudo systemctl enable nginx
   ```

### Step 2: User and Directory Setup

1. **Create service user**:
   ```bash
   sudo useradd -r -s /bin/bash -d /home/ibiki -m ibiki
   ```

2. **Create application directory**:
   ```bash
   sudo mkdir -p /opt/ibiki-sms
   sudo chown ibiki:ibiki /opt/ibiki-sms
   ```

### Step 3: Application Deployment

1. **Copy application files**:
   ```bash
   sudo cp -r . /opt/ibiki-sms/
   sudo chown -R ibiki:ibiki /opt/ibiki-sms
   ```

2. **Install dependencies**:
   ```bash
   sudo -u ibiki bash -c "cd /opt/ibiki-sms && npm ci --only=production"
   ```

3. **Build the application**:
   ```bash
   sudo -u ibiki bash -c "cd /opt/ibiki-sms && npm run build"
   ```

### Step 4: Database Setup

1. **Create database user**:
   ```bash
   sudo -u postgres createuser -s ibiki
   ```

2. **Create database**:
   ```bash
   sudo -u postgres createdb -O ibiki ibiki-sms
   ```

3. **Configure environment variables**:
   ```bash
   sudo -u ibiki cp /opt/ibiki-sms/.env.production /opt/ibiki-sms/.env
   sudo -u ibiki nano /opt/ibiki-sms/.env
   ```

   **Required environment variables**:
   ```env
   # Database
   DATABASE_URL=postgresql://ibiki:password@localhost:5432/ibiki-sms

   # Security
   JWT_SECRET=your-super-secure-jwt-secret-here
   SESSION_SECRET=your-super-secure-session-secret-here

   # SMS Provider (ExtremeSMS)
   EXTREME_SMS_USERNAME=your-extreme-sms-username
   EXTREME_SMS_PASSWORD=your-extreme-sms-password

   # Application
   NODE_ENV=production
   PORT=3000
   ```

4. **Run database migrations**:
   ```bash
   sudo -u ibiki bash -c "cd /opt/ibiki-sms && npm run db:migrate"
   ```

### Step 5: Process Management Setup

1. **Start application with PM2**:
   ```bash
   sudo -u ibiki bash -c "cd /opt/ibiki-sms && pm2 start ecosystem.config.js"
   ```

2. **Save PM2 configuration**:
   ```bash
   sudo -u ibiki pm2 save
   ```

3. **Generate PM2 startup script**:
   ```bash
   sudo -u ibiki pm2 startup
   ```

4. **Create systemd service**:
   ```bash
   sudo tee /etc/systemd/system/pm2-ibiki.service > /dev/null <<EOF
   [Unit]
   Description=PM2 process manager for ibiki
   Documentation=https://pm2.keymetrics.io/
   After=network.target

   [Service]
   Type=forking
   User=ibiki
   LimitNOFILE=infinity
   LimitNPROC=infinity
   LimitCORE=infinity
   Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/opt/ibiki-sms/node_modules/.bin
   Environment=PM2_HOME=/home/ibiki/.pm2
   PIDFile=/home/ibiki/.pm2/pm2.pid
   Restart=on-failure

   ExecStart=/usr/lib/node_modules/pm2/bin/pm2 resurrect
   ExecReload=/usr/lib/node_modules/pm2/bin/pm2 reload all
   ExecStop=/usr/lib/node_modules/pm2/bin/pm2 kill

   [Install]
   WantedBy=multi-user.target
   EOF
   ```

5. **Enable and start the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable pm2-ibiki
   sudo systemctl start pm2-ibiki
   ```

### Step 6: Nginx Reverse Proxy (Optional)

1. **Create Nginx configuration**:
   ```bash
   sudo tee /etc/nginx/sites-available/ibiki-sms > /dev/null <<EOF
   server {
       listen 80;
       server_name your-domain.com;  # Replace with your domain

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host \$host;
           proxy_set_header X-Real-IP \$remote_addr;
           proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto \$scheme;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOF
   ```

2. **Enable the site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/ibiki-sms /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Step 7: SSL Certificate (Optional but Recommended)

1. **Install Certbot**:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   ```

2. **Obtain SSL certificate**:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## 🔧 Management Commands

### Application Management
```bash
# Start application
sudo systemctl start pm2-ibiki

# Stop application
sudo systemctl stop pm2-ibiki

# Restart application
sudo systemctl restart pm2-ibiki

# Check status
sudo systemctl status pm2-ibiki

# View logs
sudo -u ibiki pm2 logs

# Monitor processes
sudo -u ibiki pm2 monit
```

### Database Management
```bash
# Connect to database
sudo -u ibiki psql ibiki-sms

# Run migrations
sudo -u ibiki bash -c "cd /opt/ibiki-sms && npm run db:migrate"

# Backup database
sudo -u postgres pg_dump ibiki-sms > backup.sql

# Restore database
sudo -u postgres psql ibiki-sms < backup.sql
```

## 🔍 Troubleshooting

### Common Issues

1. **Application won't start**:
   - Check environment variables in `/opt/ibiki-sms/.env`
   - Verify database connection
   - Check PM2 logs: `sudo -u ibiki pm2 logs`

2. **Database connection errors**:
   - Verify PostgreSQL is running: `sudo systemctl status postgresql`
   - Check database credentials in `.env`
   - Ensure database exists: `sudo -u postgres psql -l`

3. **Permission errors**:
   - Ensure all files are owned by `ibiki` user
   - Check file permissions: `ls -la /opt/ibiki-sms/`

4. **Port conflicts**:
   - Check if port 3000 is in use: `sudo netstat -tlnp | grep 3000`
   - Change port in `.env` if needed

### Log Locations
- **Application logs**: `/home/ibiki/.pm2/logs/`
- **Nginx logs**: `/var/log/nginx/`
- **PostgreSQL logs**: `/var/log/postgresql/`
- **System logs**: `journalctl -u pm2-ibiki`

## 🔒 Security Considerations

1. **Firewall Configuration**:
   ```bash
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **Regular Updates**:
   ```bash
   # Update system packages
   sudo apt update && sudo apt upgrade

   # Update Node.js dependencies
   sudo -u ibiki bash -c "cd /opt/ibiki-sms && npm audit fix"
   ```

3. **Environment Variables**:
   - Use strong, unique secrets for JWT_SECRET and SESSION_SECRET
   - Restrict access to `.env` file: `chmod 600 /opt/ibiki-sms/.env`

4. **Database Security**:
   - Use strong database passwords
   - Restrict database access to localhost only
   - Regular database backups

## 📊 Monitoring and Maintenance

### Health Checks
- Application health: `curl http://localhost:3000/api/health`
- Database health: `curl http://localhost:3000/api/health/detailed`

### Performance Monitoring
```bash
# PM2 monitoring
sudo -u ibiki pm2 monit

# System resources
htop
df -h
free -h
```

### Backup Strategy
1. **Database backups**: Daily automated backups
2. **Application files**: Version control with Git
3. **Configuration files**: Include `.env` in secure backups

## 🆘 Support

For issues and support:
1. Check the troubleshooting section above
2. Review application logs
3. Consult the project documentation
4. Contact the development team

## 📝 Version Information

- **Application Version**: Check `VERSION` file
- **Node.js**: 20.x+
- **PostgreSQL**: 12+
- **PM2**: Latest stable

---

**Note**: This guide assumes a fresh Ubuntu/Debian installation. Adjust commands as needed for other Linux distributions.