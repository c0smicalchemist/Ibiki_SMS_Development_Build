#!/bin/bash

##############################################################################
# IBIKI SMS v14.1 - DEPLOYMENT SCRIPT
# Fixes: Database schema sync issue (admin dashboard not showing clients)
##############################################################################

set -e

echo "============================================================================="
echo "🚀 IBIKI SMS v14.1 DEPLOYMENT"
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
echo "4️⃣ Installing dependencies..."
npm install --production=false

# Build
echo "5️⃣ Building application..."
npm run build

# CRITICAL FIX: Sync database schema
echo "6️⃣ Syncing database schema (CRITICAL FIX)..."
echo "   This fixes the 'admin dashboard not showing clients' issue"
npm run db:push --force 2>/dev/null || npm run db:push

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
echo ""
echo "🔍 VERIFY THE FIX:"
echo "   1. Open http://151.243.109.79 in browser"
echo "   2. Login as admin"
echo "   3. Go to Admin Dashboard → Clients tab"
echo "   4. You should now see all registered clients!"
echo ""
echo "📋 What was fixed:"
echo "   - Database schema synced (added sender_phone_number column)"
echo "   - Admin dashboard will now load client list correctly"
echo "   - You can allocate credits and manage clients"
echo ""
