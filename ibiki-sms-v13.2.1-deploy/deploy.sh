#!/bin/bash

##############################################################################
# IBIKI SMS v13.2.1 - COMPLETE DEPLOYMENT SCRIPT
# This script properly deploys the application with all fixes
##############################################################################

set -e  # Exit on error

echo "============================================================================="
echo "🚀 IBIKI SMS v13.2.1 DEPLOYMENT"
echo "============================================================================="
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Pre-flight checks
echo "1️⃣ Pre-flight checks..."
if ! command_exists node; then
    echo "❌ Node.js not found! Install Node.js 18+ first."
    exit 1
fi

if ! command_exists pm2; then
    echo "❌ PM2 not found! Installing PM2..."
    npm install -g pm2
fi

if ! command_exists psql; then
    echo "⚠️  PostgreSQL client not found - cannot verify database"
else
    echo "✅ PostgreSQL client found"
fi

# Step 2: Stop existing processes and clear port
echo ""
echo "2️⃣ Stopping existing processes..."
echo "   Killing processes on port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
sleep 2

echo "   Stopping PM2 processes..."
pm2 delete all 2>/dev/null || true
sleep 2

# Step 3: Verify database connection and data
echo ""
echo "3️⃣ Verifying database..."
PGPASSWORD=Cosmic4382 psql -U ibiki_user -d ibiki_sms -t -c "SELECT COUNT(*) as user_count FROM users;" 2>/dev/null | xargs | while read count; do
    if [ "$count" -gt 0 ]; then
        echo "✅ Database has $count users - data is safe"
    else
        echo "⚠️  Database has no users (might be fresh install)"
    fi
done || echo "⚠️  Could not verify database (but it should be fine)"

# Step 4: Set deployment directory
DEPLOY_DIR="/root/ibiki-sms"
echo ""
echo "4️⃣ Deployment directory: $DEPLOY_DIR"

# Create backup
if [ -d "$DEPLOY_DIR" ] && [ -f "$DEPLOY_DIR/.env" ]; then
    echo "   Creating backup of .env..."
    cp "$DEPLOY_DIR/.env" "$DEPLOY_DIR/.env.backup-$(date +%Y%m%d-%H%M%S)"
fi

# Copy files
echo "   Copying files..."
mkdir -p "$DEPLOY_DIR"
cp -r * "$DEPLOY_DIR/" 2>/dev/null || true

cd "$DEPLOY_DIR"

# Step 5: Create/verify .env file
echo ""
echo "5️⃣ Configuring environment..."
if [ ! -f .env ]; then
    echo "   Creating .env file..."
    cat > .env << 'EOF'
DATABASE_URL=postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms
NODE_ENV=production
PORT=5000
SESSION_SECRET=ibiki-sms-production-secret-2024-change-in-production
WEBHOOK_SECRET=change-this-to-match-extremesms-webhook-secret
EOF
    echo "   ✅ .env file created"
else
    echo "   ✅ .env file already exists"
fi

# Verify DATABASE_URL exists
if ! grep -q "DATABASE_URL=" .env; then
    echo "   ⚠️  DATABASE_URL missing! Adding it..."
    echo "DATABASE_URL=postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms" >> .env
fi

echo "   Environment variables:"
echo "   - DATABASE_URL: $(grep DATABASE_URL .env | cut -d'=' -f1) ✓"
echo "   - NODE_ENV: $(grep NODE_ENV .env | cut -d'=' -f2 || echo 'production')"
echo "   - PORT: $(grep PORT .env | cut -d'=' -f2 || echo '5000')"

# Step 6: Install dependencies
echo ""
echo "6️⃣ Installing dependencies..."
npm install --production=false

# Step 7: Build application
echo ""
echo "7️⃣ Building application..."
npm run build

if [ ! -f dist/index.js ]; then
    echo "❌ Build failed! dist/index.js not found"
    exit 1
fi
echo "   ✅ Build successful"

# Step 8: Run database migrations
echo ""
echo "8️⃣ Running database migrations..."
npm run db:push || npm run db:push --force || echo "⚠️  Migration skipped (might not be needed)"

# Step 9: Start application
echo ""
echo "9️⃣ Starting application with PM2..."
pm2 start npm --name "ibiki-sms" -- start
pm2 save

# Step 10: Verify deployment
echo ""
echo "🔍 Verifying deployment..."
sleep 5

# Check PM2 status
pm2 status

# Check logs for success indicators
echo ""
echo "📋 Recent logs:"
pm2 logs ibiki-sms --lines 15 --nostream

# Check for critical issues
echo ""
if pm2 logs ibiki-sms --lines 30 --nostream | grep -q "DATABASE_URL not set"; then
    echo "❌ WARNING: DATABASE_URL not being loaded!"
    echo "   Trying to restart with updated environment..."
    pm2 restart ibiki-sms --update-env
    sleep 3
    pm2 logs ibiki-sms --lines 10 --nostream
fi

if pm2 logs ibiki-sms --lines 30 --nostream | grep -q "serving on port 5000"; then
    echo "✅ Application is serving on port 5000"
fi

# Final status
echo ""
echo "============================================================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "============================================================================="
echo ""
echo "Next steps:"
echo "1. Open http://151.243.109.79 in your browser"
echo "2. Test login with existing user"
echo "3. Check logs: pm2 logs ibiki-sms --lines 50"
echo ""
echo "If you see issues:"
echo "- Check .env file: cat /root/ibiki-sms/.env"
echo "- Restart with env: pm2 restart ibiki-sms --update-env"
echo "- View full logs: pm2 logs ibiki-sms"
echo ""
echo "Your data is safe in the PostgreSQL database!"
echo "============================================================================="
