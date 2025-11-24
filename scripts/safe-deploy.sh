#!/bin/bash
cd /opt/ibiki-sms

echo "=== Safe Deployment Started ==="

# 1. Backup before deployment
echo "1. Creating pre-deployment backup..."
if [ -x /usr/local/bin/ibiki-backup.sh ]; then
  /usr/local/bin/ibiki-backup.sh
else
  /opt/ibiki-sms/scripts/backup.sh
fi

# 2. Save current environment
echo "2. Backing up current configuration..."
cp .env.production .env.production.backup
cp ecosystem.config.js ecosystem.config.js.backup 2>/dev/null || true

# 3. Git operations
echo "3. Updating code..."
git checkout production
git fetch origin production
git reset --hard origin/production

# 4. Restore environment and config
echo "4. Restoring configuration..."
if [ -f .env.production.backup ]; then
    cp .env.production .env.production.new
    cp .env.production.backup .env.production
    grep -v -F -f .env.production .env.production.new | grep -v "^#" >> .env.production 2>/dev/null || true
    rm .env.production.new
fi

[ -f ecosystem.config.js.backup ] && cp ecosystem.config.js.backup ecosystem.config.js

# 5. Install and build
echo "5. Installing dependencies..."
npm ci

echo "6. Building application..."
npm run build

# 6.5 Verify critical configurations are intact
echo "6.5 Verifying critical configurations..."
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL missing! Restoring from backup..."
    cp .env.production.backup .env.production
    export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)
fi

# 7. Run migrations and restart
echo "7. Running migrations and restarting..."
RUN_DB_MIGRATIONS=true pm2 restart ibiki-sms --update-env
pm2 save

# 8. Verify deployment
echo "8. Verifying deployment..."
sleep 5
pm2 status ibiki-sms

echo "9. Testing critical functionality..."
curl -s http://localhost:5000/api/health | grep -o '"status":"[^"]*"' || echo "Health check failed"

echo "10. Verifying users are intact..."
psql "$DATABASE_URL" -c "SELECT email, role, is_active FROM users ORDER BY email;" 2>/dev/null || echo "Database check failed"

echo "=== Safe Deployment Complete! ==="
