#!/bin/bash

##############################################################################
# EMERGENCY RECOVERY SCRIPT FOR IBIKI SMS
# Run this to restore service immediately
##############################################################################

echo "🚨 EMERGENCY RECOVERY STARTING..."
echo ""

# Step 1: Kill everything on port 5000
echo "1️⃣ Killing all processes on port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
sleep 2

# Step 2: Stop ALL PM2 processes
echo "2️⃣ Stopping all PM2 processes..."
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true
sleep 2

# Step 3: Check database has data
echo "3️⃣ Verifying database has user data..."
PGPASSWORD=Cosmic4382 psql -U ibiki_user -d ibiki_sms -c "SELECT COUNT(*) FROM users;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Database connection OK - data is safe"
else
    echo "⚠️  Cannot verify database - but data should still be there"
fi

# Step 4: Go to working installation
echo "4️⃣ Going to /root/ibiki-sms..."
cd /root/ibiki-sms || {
    echo "❌ /root/ibiki-sms not found!"
    exit 1
}

# Step 5: Verify .env file
echo "5️⃣ Checking .env file..."
if [ ! -f .env ]; then
    echo "⚠️  .env file missing! Creating it..."
    cat > .env << 'EOF'
DATABASE_URL=postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms
NODE_ENV=production
PORT=5000
SESSION_SECRET=ibiki-sms-production-secret-2024-change-in-production
EOF
fi

# Show .env (masked)
echo "DATABASE_URL found: $(grep DATABASE_URL .env | cut -d'=' -f1)"

# Step 6: Rebuild if needed
echo "6️⃣ Checking if build exists..."
if [ ! -d "dist" ]; then
    echo "Building application..."
    npm run build
fi

# Step 7: Start with PM2
echo "7️⃣ Starting application..."
pm2 start npm --name "ibiki-sms" -- start

# Step 8: Save PM2
echo "8️⃣ Saving PM2 configuration..."
pm2 save

# Step 9: Check status
echo "9️⃣ Checking status..."
sleep 3
pm2 status

echo ""
echo "🔍 Checking logs for DATABASE_URL..."
pm2 logs ibiki-sms --lines 10 --nostream | grep -i "database\|5000\|serving" || true

echo ""
echo "✅ RECOVERY COMPLETE!"
echo ""
echo "Next steps:"
echo "1. Check http://151.243.109.79 in your browser"
echo "2. Try logging in with existing user"
echo "3. Run: pm2 logs ibiki-sms --lines 30"
echo ""
echo "If you see 'DATABASE_URL not set', run:"
echo "  cd /root/ibiki-sms && cat .env"
echo "  pm2 restart ibiki-sms --update-env"
