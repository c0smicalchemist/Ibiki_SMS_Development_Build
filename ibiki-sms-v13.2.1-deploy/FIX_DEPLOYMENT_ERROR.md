# Fix Deployment Error - Node.js Version Issue

## 🚨 **The Problem**

You're getting this error:
```
TypeError [ERR_INVALID_ARG_TYPE]: The "paths[0]" argument must be of type string. Received undefined
```

**Root Cause:** The application requires **Node.js 20+** but your server has **Node.js 18**.

The code uses `import.meta.dirname` which is only available in Node 20+.

---

## ✅ **The Solution - Run This on Your Server**

I've created a fix script in the ZIP. After extracting, run:

```bash
# On your server at /root/deploy-temp/IbikiGateway
chmod +x fix-node-version.sh
sudo ./fix-node-version.sh
```

This script will:
1. ✅ Upgrade Node.js to version 20
2. ✅ Rebuild the application
3. ✅ Restart PM2
4. ✅ Verify it's working

---

## 📋 **Manual Fix (If Script Doesn't Work)**

```bash
# 1. Upgrade Node.js to version 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# 2. Verify version
node --version
# Should show v20.x.x

# 3. Rebuild the app
cd /opt/ibiki-sms
sudo pm2 stop ibiki-sms
sudo rm -rf dist/ node_modules/
sudo npm install
sudo npm run build

# 4. Test it
NODE_ENV=production PORT=3100 node dist/index.js
# Press Ctrl+C after you see "serving on port 3100"

# 5. Restart with PM2
sudo pm2 restart ibiki-sms

# 6. Check status
pm2 status
pm2 logs ibiki-sms
```

---

## ✅ **After Running the Fix**

Visit: `http://151.243.109.79` (no port needed - Nginx reverse proxy!)

Or direct: `http://151.243.109.79:6000`

You should see the Ibiki SMS landing page!

---

## 🔍 **Why This Happened**

The deployment script tried to install Node 20, but something went wrong and Node 18 remained active. The fix script ensures Node 20 is properly installed and used.

---

## 📞 **Verify It's Working**

```bash
# Check Node version
node --version
# Should be v20.x.x

# Check PM2
pm2 list
# ibiki-sms should be "online"

# Test locally
curl http://localhost:3100
# Should return HTML

# Check in browser
http://151.243.109.79:3100
# Should show landing page
```

---

**Run the fix script now and you'll be up and running!** 🚀
