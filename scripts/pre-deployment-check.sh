#!/bin/bash
cd /opt/ibiki-sms

echo "=== Pre-Deployment Safety Check ==="

# 1. Current status
echo "1. Current Application Status:"
pm2 status ibiki-sms

# 2. Database check
echo "2. Database Status:"
export DATABASE_URL=$(grep DATABASE_URL .env.production | cut -d '=' -f2-)
psql "$DATABASE_URL" -c "SELECT email, role, is_active FROM users ORDER BY email;"

# 3. Backup status
echo "3. Backup Status:"
sudo ls -la /var/backups/ibiki-sms/ | tail -5

# 4. Critical files
echo "4. Critical Files:"
ls -la .env.production ecosystem.config.js 2>/dev/null || echo "Some config files missing"

# 5. Current git status
echo "5. Git Status:"
git status --short
git log --oneline -5

echo "=== Safety Check Complete ==="
echo "If all above looks good, run: /opt/ibiki-sms/safe-deploy.sh"

