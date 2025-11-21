# Ibiki SMS - Production Deployment Guide

This is the production-ready version of Ibiki SMS, cleaned up and optimized for deployment on Linux servers.

## 🚀 Quick Deployment

1. **Clone or upload this repository to your server**
2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   nano .env
   ```
3. **Run the deployment script:**
   ```bash
   ./deploy.sh
   ```

## 📋 Prerequisites

- **Node.js 18+** - Required for running the application
- **PostgreSQL** - Database for storing SMS data
- **PM2** - Process manager (will be installed automatically)
- **Linux Server** - Ubuntu 20.04+ or similar

## 🔧 Manual Installation

If you prefer manual installation:

### 1. Install Dependencies
```bash
npm ci --only=production
```

### 2. Build Application
```bash
npm run build
```

### 3. Configure Environment
Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Random secret for JWT tokens
- `WEBHOOK_SECRET` - Secret for ExtremeSMS webhooks
- `RESEND_API_KEY` - Optional, for password reset emails

### 4. Start with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 🌐 Reverse Proxy Setup

### Nginx Configuration
```nginx
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

## 📊 Monitoring

- **Check status:** `pm2 status`
- **View logs:** `pm2 logs ibiki-sms`
- **Restart app:** `pm2 restart ibiki-sms`
- **Stop app:** `pm2 stop ibiki-sms`

## 🔒 Security Considerations

1. **Environment Variables:** Never commit `.env` files
2. **Database:** Use strong passwords and restrict access
3. **Firewall:** Only expose necessary ports (80, 443, SSH)
4. **SSL:** Use Let's Encrypt or similar for HTTPS
5. **Updates:** Keep Node.js and dependencies updated

## 📁 Project Structure

```
ibiki-sms/
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schemas
├── migrations/      # Database migrations
├── dist/           # Built application (generated)
├── logs/           # Application logs (generated)
├── .env.example    # Environment template
├── deploy.sh       # Deployment script
└── ecosystem.config.js  # PM2 configuration
```

## 🐛 Troubleshooting

### Application won't start
- Check `.env` file configuration
- Verify database connection
- Check logs: `pm2 logs ibiki-sms`

### Database connection issues
- Verify `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Check network connectivity

### Port already in use
- Change `PORT` in `.env`
- Update PM2 config and restart

## 📞 Support

For issues and support, check the application logs and ensure all environment variables are properly configured.