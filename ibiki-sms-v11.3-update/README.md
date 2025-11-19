# Ibiki SMS v11.3 - Update Package

## 🎯 What This Updates

This is a **lightweight update** that adds complete translation support WITHOUT touching your database or existing clients.

### ✅ Safe Update
- **No database changes** - All client data preserved
- **No migrations** - Just file updates
- **No downtime** - Quick restart only
- **Easy rollback** - Backups created automatically

---

## 📦 What's Included

**3 Updated Files:**
1. `client/src/lib/i18n.ts` - Added missing translations
2. `client/src/pages/ApiDocs.tsx` - Uses translation system
3. `client/src/pages/ClientDashboard.tsx` - Uses translation system

**Total Size:** ~50KB

---

## 🚀 Quick Install

```bash
# Extract update package
tar -xzf ibiki-sms-v11.3-update.tar.gz
cd ibiki-sms-v11.3-update

# Run update script
chmod +x UPDATE.sh
./UPDATE.sh
```

**That's it!** Your app now has full translation support.

---

## 🔄 Manual Installation

If you prefer manual installation:

```bash
# 1. Backup current files
mkdir -p backups
cp client/src/lib/i18n.ts backups/
cp client/src/pages/ApiDocs.tsx backups/
cp client/src/pages/ClientDashboard.tsx backups/

# 2. Copy new files
cp client/src/lib/i18n.ts /path/to/your/app/client/src/lib/
cp client/src/pages/ApiDocs.tsx /path/to/your/app/client/src/pages/
cp client/src/pages/ClientDashboard.tsx /path/to/your/app/client/src/pages/

# 3. Restart app
pm2 restart ibiki-sms
```

---

## 🌍 What Gets Translated

### Before Update (v11.2)
- ❌ API Documentation - English only
- ❌ Inbox messages - Hardcoded English
- ❌ Some dashboard text - Hardcoded English

### After Update (v11.3)
- ✅ **Everything** - Full English + Chinese support
- ✅ API Documentation - Fully translated
- ✅ Inbox messages - Translated
- ✅ Dashboard - 100% translated
- ✅ Client can read everything in their language

---

## 🧪 Testing After Update

1. **Open your application**
2. **Click language toggle** (EN / 中文 button in header)
3. **Test these pages:**
   - Dashboard → Check Inbox section
   - API Documentation → All endpoints translated
   - Client Dashboard → All text translated

Everything should switch language instantly!

---

## 🔧 Troubleshooting

### App Not Restarting?
```bash
# Restart manually:
cd /path/to/your/app
pm2 restart ibiki-sms
```

### Want to Rollback?
```bash
# Restore backups
cp backups/i18n.ts.backup client/src/lib/i18n.ts
cp backups/ApiDocs.tsx.backup client/src/pages/ApiDocs.tsx
cp backups/ClientDashboard.tsx.backup client/src/pages/ClientDashboard.tsx

# Restart
pm2 restart ibiki-sms
```

---

## ✨ Features Added

### New Translation Keys
- `inbox.*` - Incoming messages section
- `dashboard.stats.operational` - System status
- `dashboard.stats.inbox` - Inbox stat card
- `dashboard.stats.inboxMessages` - Inbox description
- Complete API docs translations

### Files Changed
- ✅ `i18n.ts` - Added 10+ new translation keys (EN + 中文)
- ✅ `ApiDocs.tsx` - Uses `useLanguage()` hook
- ✅ `ClientDashboard.tsx` - All hardcoded text replaced with `t()` calls

---

## 📊 Version Info

- **From:** v11.2 (Privacy Update)
- **To:** v11.3 (Full Translation Support)
- **Size:** ~50KB
- **Install Time:** < 1 minute
- **Downtime:** ~5 seconds (restart only)

---

## ❓ Questions?

- **Will this affect my clients?** No, they'll just see the new language toggle feature
- **Will I lose data?** No, zero database changes
- **Can I rollback?** Yes, backups are created automatically
- **Do I need to tell clients?** Optional - they'll discover the language toggle

---

**Version:** 11.3  
**Date:** November 19, 2025  
**Status:** Production Ready ✅
