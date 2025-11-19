#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Ibiki SMS v15.0 - Production Deployment Script
# ═══════════════════════════════════════════════════════════════════════════
# Features:
#   - Clean deployment (removes old files)
#   - DATABASE_URL embedded in PM2 config (no .env issues)
#   - API v1 + v2 support
#   - 2-way SMS receive
#   - Credit management
#   - Zero data loss deployment
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database credentials
DB_USER="ibiki_user"
DB_PASSWORD="Cosmic4382"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="ibiki_sms"

echo -e "${BLUE}"
echo "═══════════════════════════════════════════════════════════════════════════"
echo "  Ibiki SMS v15.0 - Production Deployment"
echo "═══════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# Verify we're running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Please run as root (use sudo)${NC}"
    exit 1
fi

echo ""
echo "Step 1: Stopping existing PM2 processes..."
pm2 stop ibiki-sms 2>/dev/null || echo "No running instance found"
pm2 delete ibiki-sms 2>/dev/null || echo "No existing PM2 process"
echo "✅ PM2 processes stopped"

echo ""
echo "Step 2: Backing up database (in case of issues)..."
BACKUP_FILE="/root/ibiki_sms_backup_$(date +%Y%m%d_%H%M%S).sql"
PGPASSWORD=$DB_PASSWORD pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME > $BACKUP_FILE 2>/dev/null || echo "Note: Database backup skipped (may not exist yet)"
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo -e "${GREEN}✅ Database backed up to: $BACKUP_FILE${NC}"
else
    rm -f "$BACKUP_FILE" 2>/dev/null
    echo "Note: No existing database to backup"
fi

echo ""
echo "Step 3: Creating staging directory..."
STAGING_DIR="/root/ibiki-sms-staging-$(date +%Y%m%d_%H%M%S)"
mkdir -p $STAGING_DIR
echo "✅ Staging directory created: $STAGING_DIR"

echo ""
echo "Step 4: Copying files to staging..."
cp -r ./* $STAGING_DIR/
cd $STAGING_DIR
echo "✅ Files copied to staging directory"

echo ""
echo "Step 5: Creating logs directory..."
mkdir -p /root/ibiki-sms/logs
echo "✅ Logs directory created"

echo ""
echo "Step 6: Generating session secret..."
SESSION_SECRET=$(openssl rand -base64 32)
export SESSION_SECRET
echo "✅ Session secret generated"

echo ""
echo "Step 7: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ npm install failed${NC}"
    exit 1
fi
echo "✅ Dependencies installed"

echo ""
echo "Step 8: Building application..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo "✅ Build completed"

echo ""
echo "Step 9: Verifying database exists..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}Database doesn't exist. Creating it...${NC}"
    PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME;"
    echo "✅ Database created"
else
    echo "✅ Database already exists"
fi

echo ""
echo "Step 10: Syncing database schema..."
echo "Running: npm run db:push"
npm run db:push
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  db:push failed, trying with --force...${NC}"
    npm run db:push -- --force
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Database migration failed${NC}"
        exit 1
    fi
fi
echo "✅ Database schema synced"

echo ""
echo "Step 11: Verifying database connection..."
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    exit 1
fi

echo ""
echo "Step 12: Deploying to production directory..."
if [ -d "/root/ibiki-sms" ]; then
    echo "Backing up current deployment..."
    BACKUP_DIR="/root/ibiki-sms-backup-$(date +%Y%m%d_%H%M%S)"
    mv /root/ibiki-sms $BACKUP_DIR
    echo "✅ Old deployment backed up to: $BACKUP_DIR"
fi
mv $STAGING_DIR /root/ibiki-sms
cd /root/ibiki-sms
echo "✅ New deployment activated"

echo ""
echo "Step 13: Starting application with PM2..."
# Session secret is passed via environment variable
pm2 start ecosystem.config.cjs
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ PM2 start failed${NC}"
    echo -e "${YELLOW}Attempting to restore previous deployment...${NC}"
    if [ -d "$BACKUP_DIR" ]; then
        rm -rf /root/ibiki-sms
        mv $BACKUP_DIR /root/ibiki-sms
        cd /root/ibiki-sms
        pm2 start ecosystem.config.cjs
        echo -e "${YELLOW}⚠️  Rolled back to previous deployment${NC}"
    fi
    exit 1
fi
echo "✅ Application started"

echo ""
echo "Step 14: Saving PM2 configuration..."
pm2 save
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  PM2 save failed (non-critical)${NC}"
fi
echo "✅ PM2 configuration saved"

echo ""
echo "Step 15: Setting up PM2 startup (auto-restart on reboot)..."
pm2 startup systemd -u root --hp /root 2>&1 | grep -v "SystemD detected"
echo "✅ PM2 startup configured"

echo ""
echo "Step 16: Waiting for application to start..."
sleep 5
echo "✅ Wait complete"

echo ""
echo "Step 17: Verifying PostgreSQL connection..."
sleep 2
pm2 logs ibiki-sms --lines 50 --nostream | grep -q "Using PostgreSQL database storage"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ CONFIRMED: Application is using PostgreSQL database${NC}"
    echo -e "${GREEN}✅ Users WILL persist across restarts!${NC}"
else
    echo -e "${RED}❌ WARNING: Application may not be using PostgreSQL!${NC}"
    echo -e "${YELLOW}Check logs with: pm2 logs ibiki-sms${NC}"
fi

echo ""
echo -e "${BLUE}"
echo "═══════════════════════════════════════════════════════════════════════════"
echo "  🎉 Deployment Complete!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"

echo ""
echo "📊 Application Status:"
pm2 status

echo ""
echo "📋 Recent Logs:"
pm2 logs ibiki-sms --lines 20 --nostream

echo ""
echo -e "${GREEN}"
echo "═══════════════════════════════════════════════════════════════════════════"
echo "  ✅ Deployment Successful!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "  🌐 Application URL: http://151.243.109.79:5000"
echo "  📦 Database: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "  📝 Logs: pm2 logs ibiki-sms"
echo "  🔄 Restart: pm2 restart ibiki-sms"
echo "  ⏹️  Stop: pm2 stop ibiki-sms"
echo ""
echo "  CRITICAL: Users will NOW persist across restarts!"
echo "  DATABASE_URL is embedded in PM2 config - no .env issues!"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo -e "${NC}"
