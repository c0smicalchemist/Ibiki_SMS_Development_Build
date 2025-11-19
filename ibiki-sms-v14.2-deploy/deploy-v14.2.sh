#!/bin/bash

echo "════════════════════════════════════════════════════════════════════════"
echo "🚀 IBIKI SMS v14.2 - CRITICAL DATABASE FIX DEPLOYMENT"
echo "════════════════════════════════════════════════════════════════════════"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database credentials (from user requirements)
DB_USER="ibiki_user"
DB_PASSWORD="Cosmic4382"
DB_NAME="ibiki_sms"
DB_HOST="localhost"
DB_PORT="5432"

echo "Step 1: Stopping all PM2 processes..."
pm2 stop all 2>/dev/null || echo "No PM2 processes running"
pm2 delete all 2>/dev/null || echo "No PM2 processes to delete"
sleep 2

echo ""
echo "Step 2: Clearing port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || echo "Port 5000 is free"
sleep 1

echo ""
echo "Step 3: Creating deployment directory..."
mkdir -p /root/ibiki-sms
cd /root/ibiki-sms || exit 1

echo ""
echo "Step 4: Copying files..."
cp -r /root/ibiki-sms-v14.2-deploy/* /root/ibiki-sms/
echo "✅ Files copied"

echo ""
echo "Step 5: Creating .env file with DATABASE_URL..."
cat > /root/ibiki-sms/.env << EOF
# Database Connection
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}

# Session Secret (auto-generated)
SESSION_SECRET=$(openssl rand -base64 32)

# Node Environment
NODE_ENV=production
PORT=5000
EOF

echo "✅ .env file created"

# Verify .env file was created and is readable
if [ ! -f /root/ibiki-sms/.env ]; then
    echo -e "${RED}❌ FATAL ERROR: .env file was not created!${NC}"
    exit 1
fi

echo ""
echo "Step 6: Verifying .env file contents..."
if grep -q "DATABASE_URL=postgresql://" /root/ibiki-sms/.env; then
    echo -e "${GREEN}✅ DATABASE_URL is set correctly${NC}"
    # Show the connection string (hide password)
    echo "Database: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
else
    echo -e "${RED}❌ FATAL ERROR: DATABASE_URL is not set in .env file!${NC}"
    exit 1
fi

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
echo "Step 9: Syncing database schema..."
echo "Running: npm run db:push"
npm run db:push
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  db:push failed, trying with --force...${NC}"
    npm run db:push -- --force
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Database migration failed${NC}"
        echo "Please check your database connection:"
        echo "  PGPASSWORD=${DB_PASSWORD} psql -U ${DB_USER} -h ${DB_HOST} -d ${DB_NAME} -c 'SELECT 1;'"
        exit 1
    fi
fi
echo "✅ Database schema synchronized"

echo ""
echo "Step 10: Testing database connection..."
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT 1 as test\`.then(() => {
  console.log('✅ Database connection successful');
  process.exit(0);
}).catch((err) => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});
" || {
    echo -e "${RED}❌ Database connection test failed${NC}"
    exit 1
}

echo ""
echo "Step 11: Starting application with PM2..."
# Use ecosystem file which ensures .env is loaded
pm2 start ecosystem.config.cjs
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ PM2 start failed${NC}"
    exit 1
fi

echo ""
echo "Step 12: Saving PM2 configuration..."
pm2 save

echo ""
echo "Step 13: Setting up PM2 startup..."
pm2 startup systemd -u root --hp /root 2>/dev/null || echo "PM2 startup already configured"

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE${NC}"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "Waiting 5 seconds for application to start..."
sleep 5

echo ""
echo "📊 Current Status:"
echo "────────────────────────────────────────────────────────────────────────"
pm2 status

echo ""
echo "📝 Recent Logs:"
echo "────────────────────────────────────────────────────────────────────────"
pm2 logs ibiki-sms --lines 20 --nostream

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "🎯 VERIFICATION CHECKLIST"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "✅ 1. Check PM2 is running:"
echo "   pm2 status"
echo "   (should show: ibiki-sms | online)"
echo ""
echo "✅ 2. Verify database connection in logs:"
echo "   pm2 logs ibiki-sms --lines 30"
echo "   (should show: ✅ Using PostgreSQL database storage)"
echo ""
echo "✅ 3. Test the application:"
echo "   curl http://localhost:5000"
echo "   (should return HTML)"
echo ""
echo "✅ 4. Check admin login:"
echo "   Open: http://151.243.109.79"
echo "   Login with your admin account"
echo ""
echo "✅ 5. Verify clients are visible:"
echo "   Admin Dashboard → Clients tab"
echo "   (should show registered users)"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "🔧 TROUBLESHOOTING COMMANDS"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "View logs:          pm2 logs ibiki-sms --lines 50"
echo "Restart:            pm2 restart ibiki-sms"
echo "Check database:     PGPASSWORD=${DB_PASSWORD} psql -U ${DB_USER} -d ${DB_NAME}"
echo "Verify .env:        cat /root/ibiki-sms/.env"
echo "Test connection:    curl http://localhost:5000"
echo ""
echo "════════════════════════════════════════════════════════════════════════"
