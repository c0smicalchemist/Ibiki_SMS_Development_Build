# 📦 IBIKI SMS v8 - DEPLOYMENT PACKAGE

**Version**: 8  
**Release Date**: November 18, 2025  
**Package**: ibiki-sms-deployment-v8-final.tar.gz (7.4 MB)

---

## 🆕 NEW IN VERSION 8

### **1. Complete API Key Management System**

#### **During Signup:**
- ✅ API key displayed in dialog with **COPY BUTTON**
- ✅ Show/hide toggle for security
- ✅ Warning that key won't be shown again
- ✅ Can't close until "I've Saved My Key" is clicked

#### **In Client Dashboard:**
- ✅ View **all your API keys** (supports multiple keys)
- ✅ Keys shown in **masked format** for security (prefix...suffix)
- ✅ **Copy button** for each masked key
- ✅ **Generate New Key** button
  - Instantly creates a new key
  - Shows full key once in a dialog
  - Has copy button
- ✅ **Revoke Key** button for each key
  - Deactivates the key immediately
  - Confirmation dialog prevents accidents
  - Shows key creation date & last used date

### **2. Admin Testing & Monitoring**

#### **API Testing Tab:**
- ✅ Test ALL endpoints from dashboard
- ✅ Quick test buttons
- ✅ Custom JSON payload editor
- ✅ **Security**: Uses admin ExtremeSMS key (NOT client keys!)
- ✅ See full request/response data

#### **Error Logs Tab:**
- ✅ Real-time monitoring (auto-refresh every 10s)
- ✅ Filter by log level
- ✅ See failed SMS deliveries
- ✅ Expandable error details

---

## 🚀 DEPLOYMENT INSTRUCTIONS

### **Step 1: Upload Package**
```bash
scp ibiki-sms-deployment-v8-final.tar.gz root@151.243.109.79:/root/
```

### **Step 2: Stop & Clean**
```bash
ssh root@151.243.109.79

# Stop old version
PM2_HOME=/home/ibiki/.pm2 pm2 delete ibiki-sms 2>/dev/null || true

# Clean up
cd /root
rm -rf ibiki-sms ibiki-sms-deployment*.tar.gz
```

### **Step 3: Extract & Deploy**
```bash
# Extract
mkdir ibiki-sms
tar -xzf ibiki-sms-deployment-v8-final.tar.gz -C ibiki-sms

# Deploy
cd ibiki-sms
chmod +x deploy.sh
sudo ./deploy.sh
```

### **Step 4: Verify**
```bash
# Check status
PM2_HOME=/home/ibiki/.pm2 pm2 status

# View logs
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 50
```

---

## 🎯 HOW TO USE NEW FEATURES

### **Manage Your API Keys:**

1. **After Signup:**
   - API key appears in dialog
   - Click **Copy** button
   - Save in password manager
   - Click "I've Saved My Key"

2. **In Dashboard:**
   - See all your keys (masked)
   - Click **Copy** to copy masked key
   - Click **Generate New Key** to create another
   - Click **Revoke** (trash icon) to deactivate a key

3. **Generate Additional Keys:**
   - Useful for different applications
   - Each app can have its own key
   - Revoke without affecting others

### **Test API Endpoints (Admin Only):**

1. Go to: **Admin Dashboard** → **API Testing** tab
2. Select endpoint (balance, sendsingle, sendbulk, etc.)
3. Edit payload if needed
4. Click **Test Endpoint**
5. See results instantly

### **Monitor Errors (Admin Only):**

1. Go to: **Admin Dashboard** → **Error Logs** tab
2. Filter by level (all, error, warning, info)
3. View failed deliveries
4. Click "View Details" for full error info
5. Auto-refreshes every 10 seconds

---

## 📋 COMPLETE FEATURE LIST (v1-v8)

### **Core Features:**
- ✅ SMS API middleware (hides ExtremeSMS)
- ✅ Multi-client system with individual credit balances
- ✅ **Multiple API keys per client** (NEW in v8)
- ✅ Pricing markup system
- ✅ Usage tracking & audit logs
- ✅ Multilingual (English/Chinese)

### **Client Features:**
- ✅ **API Key Management** (NEW in v8)
  - Generate multiple keys
  - Revoke individual keys
  - Copy with one click
  - Full key shown only once
- ✅ View masked API keys securely
- ✅ Check credit balance
- ✅ View message logs
- ✅ Request credit top-ups

### **Admin Features:**
- ✅ Client management
- ✅ ExtremeSMS configuration
- ✅ Test Connection (with status badge)
- ✅ **API Testing utility** (NEW in v8)
- ✅ **Error Logs viewer** (NEW in v8)
- ✅ Add credits to clients
- ✅ View all clients

### **Security:**
- ✅ API keys hashed (SHA-256)
- ✅ Keys displayed once with copy button
- ✅ Masked display in dashboard
- ✅ Admin tests use ExtremeSMS key (not client keys)
- ✅ JWT authentication
- ✅ Role-based access control

### **API Endpoints:**
- ✅ POST /api/v2/sms/sendsingle
- ✅ POST /api/v2/sms/sendbulk
- ✅ POST /api/v2/sms/sendbulkmulti
- ✅ GET /api/v2/sms/status/{messageId}
- ✅ GET /api/v2/account/balance

### **Developer Tools:**
- ✅ Complete API documentation
- ✅ Test script (test-api.js)
- ✅ Testing guide (TEST-API.md)

---

## 🔑 API KEY WORKFLOW

### **For Clients:**

1. **Sign Up** → API key dialog appears
2. **Copy Key** → Use copy button
3. **Save Securely** → Store in password manager
4. **Use Key** → In your application

**Need Another Key?**
1. **Login** → Go to dashboard
2. **Click "Generate New Key"**
3. **Copy from dialog**
4. **Use in another app**

**Key Compromised?**
1. **Go to dashboard**
2. **Find the compromised key**
3. **Click Revoke (trash icon)**
4. **Generate a new key**

### **For Admins:**

**Testing Endpoints:**
1. **Configure ExtremeSMS key** first
2. **Go to API Testing tab**
3. **Select endpoint to test**
4. **View results**

**Monitoring Errors:**
1. **Go to Error Logs tab**
2. **See failed deliveries**
3. **Filter by level**
4. **Auto-refreshes**

---

## 🎓 BEST PRACTICES

### **API Key Security:**
- ✅ **DO**: Save key immediately when shown
- ✅ **DO**: Store in password manager
- ✅ **DO**: Use different keys for different apps
- ✅ **DO**: Revoke compromised keys immediately
- ❌ **DON'T**: Share keys publicly
- ❌ **DON'T**: Commit keys to Git
- ❌ **DON'T**: Use the same key everywhere

### **Key Management:**
- Generate separate keys for:
  - Development environment
  - Staging environment
  - Production environment
  - Different client applications

- Rotate keys regularly:
  - Generate new key
  - Update applications
  - Revoke old key

---

## 📞 SUPPORT

### **Check Logs:**
```bash
ssh root@151.243.109.79
PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms
```

### **Restart Service:**
```bash
PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms
```

### **Common Issues:**

**"API key not found"**
- Key might be revoked
- Check in dashboard if key is active
- Generate a new key

**"Cannot copy API key"**
- Browser permission issue
- Manually select and copy
- Check clipboard permissions

---

## ✅ DEPLOYMENT CHECKLIST

- [ ] Upload v8 package to server
- [ ] Stop old PM2 process
- [ ] Extract package
- [ ] Run deploy.sh
- [ ] Verify PM2 status = "online"
- [ ] Access http://151.243.109.79
- [ ] Sign up / Login
- [ ] **Test API key copy button**
- [ ] **Generate a new API key**
- [ ] **Revoke a test key**
- [ ] Configure ExtremeSMS API key
- [ ] Test Connection
- [ ] Test API endpoints (Admin → API Testing)
- [ ] Check Error Logs (Admin → Error Logs)
- [ ] Create test client
- [ ] Add credits
- [ ] Test client API requests

---

**🎉 Version 8 is ready for deployment!**

**Download**: `ibiki-sms-deployment-v8-final.tar.gz`

All features tested and working on **151.243.109.79** 🚀
