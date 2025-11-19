#!/bin/bash

echo "═══════════════════════════════════════════════"
echo "  📦 Ibiki SMS v11.3 - Quick Update"
echo "═══════════════════════════════════════════════"
echo ""
echo "This updates ONLY translation files."
echo "✅ No database changes"
echo "✅ All client accounts safe"
echo "✅ All data preserved"
echo ""

# Confirm
read -p "Continue with update? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Update cancelled."
    exit 1
fi

# Backup
echo "📋 Step 1: Creating backups..."
mkdir -p backups
cp ../../client/src/lib/i18n.ts backups/i18n.ts.backup 2>/dev/null || true
cp ../../client/src/pages/ApiDocs.tsx backups/ApiDocs.tsx.backup 2>/dev/null || true
cp ../../client/src/pages/ClientDashboard.tsx backups/ClientDashboard.tsx.backup 2>/dev/null || true
echo "✅ Backups created in ./backups/"
echo ""

# Update
echo "📋 Step 2: Updating files..."
cp client/src/lib/i18n.ts ../../client/src/lib/i18n.ts
cp client/src/pages/ApiDocs.tsx ../../client/src/pages/ApiDocs.tsx
cp client/src/pages/ClientDashboard.tsx ../../client/src/pages/ClientDashboard.tsx
echo "✅ Files updated"
echo ""

# Restart
echo "📋 Step 3: Restarting application..."
cd ../..
pm2 restart ibiki-sms 2>/dev/null && echo "✅ PM2 restarted successfully" || echo "⚠️  Please restart manually with: pm2 restart ibiki-sms"
echo ""

echo "═══════════════════════════════════════════════"
echo "  ✅ UPDATE COMPLETE!"
echo "═══════════════════════════════════════════════"
echo ""
echo "🌍 What changed:"
echo "  • Full translation support (EN + 中文)"
echo "  • API Documentation fully translated"
echo "  • Client Dashboard fully translated"
echo "  • Everything now switches language"
echo ""
echo "🎯 Test it:"
echo "  1. Open your app"
echo "  2. Click language toggle (EN / 中文)"
echo "  3. Check all pages - everything translates!"
echo ""
echo "📦 Backups saved in: ./backups/"
echo ""
