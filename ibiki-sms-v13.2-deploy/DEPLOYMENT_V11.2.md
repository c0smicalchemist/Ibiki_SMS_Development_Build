# Ibiki SMS v11.2 - Privacy & Branding Update

## ✅ What's New in v11.2

### **Complete Backend Privacy**
All client-facing areas now use generic "SMS provider" language:
- ✅ Webhook Setup tab → Generic instructions
- ✅ API Documentation → No vendor mentions
- ✅ Client dashboard → Vendor-neutral
- ✅ Professional branding → Only "Ibiki SMS" visible to clients

### **What Changed**
**Before (v11.1):**
- ❌ "Configure in your **ExtremeSMS account**"
- ❌ "**ExtremeSMS** will POST this payload"
- ❌ "Login to your **ExtremeSMS account**"

**After (v11.2):**
- ✅ "Configure in your **SMS provider account**"
- ✅ "**Your SMS provider** will POST this payload"
- ✅ "Login to your **SMS provider account**"

---

## 📦 Complete Feature Set

### **2-Way SMS System**
- Webhook endpoint: `/webhook/incoming-sms`
- Client inbox with auto-refresh (5 seconds)
- Multiple phone numbers per client (unlimited)
- Automatic message routing

### **Admin Dashboard**
- System configuration (backend settings)
- Client management with phone number assignment
- Webhook Setup tab with copy-paste instructions
- API testing utility
- Error logs viewer
- Live balance monitoring

### **Client Experience**
- Clean API documentation (vendor-neutral)
- Dashboard inbox for incoming messages
- API key management
- Credit balance tracking
- Multilingual support (EN/中文)

### **Security & Auth**
- JWT authentication with refresh
- Password reset via email (Resend)
- API key encryption (SHA-256)
- Admin role-based access control

---

## 🚀 Quick Deploy

```bash
# Extract
tar -xzf ibiki-sms-v11.2.tar.gz
cd workspace

# Deploy (auto-runs migrations)
chmod +x deploy.sh
./deploy.sh
```

**Server:** 151.243.109.79  
**Port:** 5000 (internal), 80 (Nginx proxy)

---

## 📋 Post-Deployment

### 1. Configure Webhook

**Admin Dashboard → Webhook Setup Tab:**
1. Copy webhook URL (one-click button)
2. Login to your SMS provider backend
3. Paste: `http://151.243.109.79/webhook/incoming-sms`
4. Method: POST
5. Save

### 2. Assign Client Phone Numbers

**Admin Dashboard → Client Management:**
1. Find client row
2. Enter their numbers: `+1111, +2222, +3333`
3. Click outside to save
4. Messages auto-route to that client ✅

---

## 🎯 What Makes This Special

### **Privacy First**
Your clients never see your backend infrastructure:
- ✅ No vendor names in client-facing areas
- ✅ Generic "SMS provider" language
- ✅ Professional Ibiki SMS branding only
- ✅ Backend details hidden from API docs

### **Admin Experience**
You still see backend details where needed:
- ✅ System Config shows "ExtremeSMS" (you need to know)
- ✅ Balance monitoring labeled clearly
- ✅ API testing uses real provider name
- ✅ Webhook Setup uses generic instructions (shareable)

### **Client Experience**
Completely vendor-neutral:
- ✅ Never see "ExtremeSMS" anywhere
- ✅ Professional documentation
- ✅ Seamless integration
- ✅ Just works™

---

## 💡 Message Flow

```
Client sends SMS via Ibiki API
    ↓
Routed through your backend
    ↓
Delivered via SMS provider (120 carriers)
    ↓
Recipient replies
    ↓
SMS provider POSTs to your webhook
    ↓
Your system routes to correct client
    ↓
Appears in client dashboard
    ↓
Auto-refreshes every 5 seconds
```

**Client never knows about backend infrastructure!**

---

## 📚 Documentation

- `VERSION.md` - Version history
- `DEPLOYMENT_V11.2.md` - This file
- `WEBHOOK_SETUP_GUIDE.md` - Webhook configuration guide
- `deploy.sh` - Automated deployment script

---

## 🎉 Ready to Deploy!

**File:** `ibiki-sms-v11.2.tar.gz` (12 MB)  
**Version:** 11.2  
**Status:** Production Ready ✅  
**Date:** November 18, 2025

### Key Changes from v11.1
- All ExtremeSMS references removed from Webhook Setup tab
- Generic "SMS provider" language in all client-facing areas
- Professional vendor-neutral branding

**Deploy and your clients will never see your backend! 🎯**
