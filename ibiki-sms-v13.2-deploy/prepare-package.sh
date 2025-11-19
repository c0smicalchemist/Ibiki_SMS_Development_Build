#!/bin/bash
# This script prepares the deployment package

echo "Preparing Ibiki SMS Deployment Package..."

# Create deployment directory
DEPLOY_DIR="ibiki-sms-deploy"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy necessary files
echo "Copying files..."
cp -r client server shared $DEPLOY_DIR/
cp package.json tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js $DEPLOY_DIR/ 2>/dev/null || true
cp deploy.sh $DEPLOY_DIR/
cp CLEAN_DEPLOYMENT.md QUICKSTART_CLEAN.md README.md $DEPLOY_DIR/ 2>/dev/null || true
cp .env.example $DEPLOY_DIR/ 2>/dev/null || true

# Make deploy script executable
chmod +x $DEPLOY_DIR/deploy.sh

# Create zip
echo "Creating zip file..."
zip -r ibiki-sms-deploy.zip $DEPLOY_DIR/

echo "✅ Package ready: ibiki-sms-deploy.zip"
echo ""
echo "Upload to server:"
echo "  scp ibiki-sms-deploy.zip root@151.243.109.79:/root/"
echo ""
echo "On server:"
echo "  cd /root"
echo "  unzip ibiki-sms-deploy.zip"
echo "  cd ibiki-sms-deploy"
echo "  chmod +x deploy.sh"
echo "  sudo ./deploy.sh"
