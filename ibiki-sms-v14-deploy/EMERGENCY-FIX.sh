#!/bin/bash

##############################################################################
# EMERGENCY FIX - Run this to get back online NOW
##############################################################################

echo "🚨 EMERGENCY FIX STARTING..."

# Kill EVERYTHING
echo "Killing all processes..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
sleep 3

# Go to working directory
cd /root/ibiki-sms || exit 1

# Make sure .env exists
if [ ! -f .env ]; then
    cat > .env << 'EOF'
DATABASE_URL=postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms
NODE_ENV=production
PORT=5000
SESSION_SECRET=ibiki-sms-production-secret-2024
EOF
fi

# Remove .npmrc
rm -f .npmrc

# Start with CORRECT name: ibiki-sms (NOT ibiki-sm)
pm2 start npm --name "ibiki-sms" -- start
pm2 save

sleep 3
pm2 status
pm2 logs ibiki-sms --lines 15 --nostream

echo ""
echo "✅ FIXED - Check http://151.243.109.79"
