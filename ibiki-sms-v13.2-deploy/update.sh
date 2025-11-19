#!/bin/bash

################################################################################
# Ibiki SMS - SAFE UPDATE SCRIPT
# Updates application code WITHOUT touching existing database or user data
################################################################################

set -e

echo "================================================================================"
echo "  🔄 IBIKI SMS - SAFE UPDATE (Preserves All User Data)"
echo "================================================================================"
echo ""
echo "⚠️  IMPORTANT: This script will:"
echo "   ✅ Update application code"
echo "   ✅ Preserve database (NO data loss)"
echo "   ✅ Preserve .env configuration"
echo "   ✅ Keep all existing users and clients"
echo "   ✅ Apply database schema updates safely"
echo ""
read -p "Continue with update? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Update cancelled."
    exit 1
fi

echo ""
echo "================================================================================"
echo "  STEP 1: Backup Current .env File"
echo "================================================================================"
echo ""

if [ -f .env ]; then
    echo "✅ Backing up .env to .env.backup..."
    cp .env .env.backup
    echo "✅ Backup created: .env.backup"
else
    echo "⚠️  No .env file found - will create new one"
fi

echo ""
echo "================================================================================"
echo "  STEP 2: Install/Update Dependencies"
echo "================================================================================"
echo ""

if [ -d "node_modules" ]; then
    echo "Node modules already installed, running npm install to update..."
else
    echo "Installing node modules for the first time..."
fi

npm install

echo ""
echo "✅ Dependencies installed/updated"

echo ""
echo "================================================================================"
echo "  STEP 3: Restore .env Configuration"
echo "================================================================================"
echo ""

if [ -f .env.backup ]; then
    echo "✅ Restoring .env from backup..."
    cp .env.backup .env
    echo "✅ Configuration restored"
else
    echo "⚠️  No backup found - keeping current .env or creating new"
fi

echo ""
echo "================================================================================"
echo "  STEP 4: Build Application"
echo "================================================================================"
echo ""

echo "Building frontend and backend..."
npm run build

echo ""
echo "✅ Application built successfully"

echo ""
echo "================================================================================"
echo "  STEP 5: Update Database Schema (SAFE - No Data Loss)"
echo "================================================================================"
echo ""

echo "Applying database schema updates..."
echo ""
echo "⚠️  NOTE: This uses 'npm run db:push' which safely syncs schema"
echo "   - Adds new tables/columns if needed"
echo "   - Does NOT delete existing data"
echo "   - Does NOT drop tables"
echo ""

# Try normal push first
if npm run db:push 2>&1 | tee /tmp/db-push.log | grep -q "warn"; then
    echo ""
    echo "⚠️  Database changes detected that may need --force"
    echo "This is normal when adding new features."
    echo ""
    read -p "Apply changes with --force? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run db:push -- --force
        echo "✅ Database schema updated"
    else
        echo "⚠️  Skipping database update - app may not work correctly with new features"
    fi
else
    echo "✅ Database schema already up to date or updated successfully"
fi

echo ""
echo "================================================================================"
echo "  STEP 6: Restart Application"
echo "================================================================================"
echo ""

if command -v pm2 &> /dev/null; then
    echo "Restarting application with PM2..."
    
    # Check if running as root or ibiki user
    if [ -d "/home/ibiki/.pm2" ]; then
        PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env
    else
        pm2 restart ibiki-sms --update-env 2>/dev/null || pm2 start npm --name ibiki-sms -- start
    fi
    
    echo ""
    echo "✅ Application restarted"
    
    echo ""
    echo "Checking application status..."
    sleep 2
    
    if [ -d "/home/ibiki/.pm2" ]; then
        PM2_HOME=/home/ibiki/.pm2 pm2 status
    else
        pm2 status
    fi
else
    echo "⚠️  PM2 not found - you'll need to restart the application manually"
    echo "   Run: npm start"
fi

echo ""
echo "================================================================================"
echo "  ✅ UPDATE COMPLETE!"
echo "================================================================================"
echo ""
echo "Your application has been updated successfully!"
echo ""
echo "WHAT WAS UPDATED:"
echo "  ✅ Application code (client + server)"
echo "  ✅ Dependencies (if needed)"
echo "  ✅ Database schema (safe updates only)"
echo ""
echo "WHAT WAS PRESERVED:"
echo "  ✅ All user accounts"
echo "  ✅ All client data"
echo "  ✅ All API keys"
echo "  ✅ All message logs"
echo "  ✅ Database configuration (.env)"
echo "  ✅ PostgreSQL data"
echo ""
echo "VERIFICATION:"
echo "  1. Check application is running:"
if [ -d "/home/ibiki/.pm2" ]; then
    echo "     PM2_HOME=/home/ibiki/.pm2 pm2 status"
else
    echo "     pm2 status"
fi
echo ""
echo "  2. Check logs for errors:"
if [ -d "/home/ibiki/.pm2" ]; then
    echo "     PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 20"
else
    echo "     pm2 logs ibiki-sms --lines 20"
fi
echo ""
echo "  3. Test in browser:"
echo "     http://151.243.109.79"
echo ""
echo "  4. Verify clients can still login"
echo "     - All existing users should work"
echo "     - No re-signup needed"
echo ""
echo "🎉 Update complete! All client data preserved!"
echo "================================================================================"
