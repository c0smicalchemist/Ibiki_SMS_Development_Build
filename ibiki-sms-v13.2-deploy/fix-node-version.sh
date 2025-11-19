#!/bin/bash

# Fix Node.js version issue for Ibiki SMS
# The app requires Node.js 20+ for import.meta.dirname support

set -e

echo "========================================"
echo "Fixing Node.js Version for Ibiki SMS"
echo "========================================"
echo ""

# Check current Node version
CURRENT_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
echo "Current Node.js version: v$(node --version | cut -d'v' -f2)"

if [ "$CURRENT_VERSION" -lt 20 ]; then
    echo ""
    echo "Node.js 20+ is required for this application"
    echo "Installing Node.js 20..."
    echo ""
    
    # Remove old Node.js
    apt-get remove -y nodejs || true
    
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    echo ""
    echo "Node.js upgraded to: $(node --version)"
else
    echo "Node.js version is sufficient (20+)"
fi

echo ""
echo "========================================"
echo "Now rebuilding the application..."
echo "========================================"
echo ""

cd /opt/ibiki-sms

# Stop the service
echo "Stopping service..."
pm2 stop ibiki-sms || true

# Clean
echo "Cleaning old build..."
rm -rf dist/ node_modules/

# Reinstall with new Node version
echo "Installing dependencies..."
npm install

# Rebuild
echo "Building application..."
npm run build

# Verify build
if [ ! -f "dist/index.js" ] || [ ! -d "dist/public" ]; then
    echo "ERROR: Build failed!"
    exit 1
fi

echo ""
echo "Build successful!"
echo ""

# Test the app
echo "Testing application..."
timeout 5s node dist/index.js 2>&1 | head -20 || {
    if [ $? -eq 124 ]; then
        echo "App started successfully (timeout as expected)"
    else
        echo "ERROR: App failed to start!"
        exit 1
    fi
}

# Restart with PM2
echo ""
echo "Restarting with PM2..."
pm2 restart ibiki-sms

echo ""
echo "========================================"
echo "Fix Complete!"
echo "========================================"
echo ""
pm2 status
echo ""
echo "Check status: pm2 logs ibiki-sms"
