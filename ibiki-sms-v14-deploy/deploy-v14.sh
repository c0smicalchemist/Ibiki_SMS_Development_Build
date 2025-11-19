#!/bin/bash

##############################################################################
# IBIKI SMS v14 - SIMPLE DEPLOYMENT THAT WORKS
##############################################################################

set -e

echo "============================================================================="
echo "🚀 IBIKI SMS v14 DEPLOYMENT"
echo "============================================================================="

# Kill everything
echo "1️⃣ Cleaning up..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
sleep 3

# Go to deployment directory
DEPLOY_DIR="/root/ibiki-sms"
echo "2️⃣ Deploying to $DEPLOY_DIR..."

# Backup existing .env
if [ -f "$DEPLOY_DIR/.env" ]; then
    cp "$DEPLOY_DIR/.env" "$DEPLOY_DIR/.env.backup"
fi

# Copy files
mkdir -p "$DEPLOY_DIR"
cp -r * "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"

# Remove .npmrc if exists (causes issues)
rm -f .npmrc

# Create .env
echo "3️⃣ Creating .env..."
cat > .env << 'EOF'
DATABASE_URL=postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms
NODE_ENV=production
PORT=5000
SESSION_SECRET=ibiki-sms-production-secret-2024
WEBHOOK_SECRET=change-this-webhook-secret
EOF

# Install
echo "4️⃣ Installing..."
npm install --production=false

# Build
echo "5️⃣ Building..."
npm run build

# Migrations
echo "6️⃣ Migrations..."
npm run db:push --force 2>/dev/null || echo "Migration skipped"

# Start PM2 with CORRECT name
echo "7️⃣ Starting PM2 (name: ibiki-sms)..."
pm2 start npm --name "ibiki-sms" -- start
pm2 save

# Wait and check
sleep 5
echo ""
echo "============================================================================="
pm2 status
echo "============================================================================="
echo ""
pm2 logs ibiki-sms --lines 20 --nostream

echo ""
echo "✅ DEPLOYMENT COMPLETE"
echo "Check: http://151.243.109.79"
echo ""
