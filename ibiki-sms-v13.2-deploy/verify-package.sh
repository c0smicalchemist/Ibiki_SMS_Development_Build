#!/bin/bash

# Verification script to check if package is ready for deployment

echo "========================================="
echo "Ibiki SMS - Package Verification"
echo "========================================="
echo ""

ERRORS=0

# Check required files
echo "[1/5] Checking required files..."
for file in package.json vite.config.ts tsconfig.json deploy.sh; do
    if [ -f "$file" ]; then
        echo "  ✓ $file"
    else
        echo "  ✗ $file MISSING!"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check required directories
echo ""
echo "[2/5] Checking required directories..."
for dir in client server shared; do
    if [ -d "$dir" ]; then
        FILES=$(find $dir -type f | wc -l)
        echo "  ✓ $dir/ ($FILES files)"
    else
        echo "  ✗ $dir/ MISSING!"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check package.json scripts
echo ""
echo "[3/5] Checking package.json scripts..."
if grep -q '"build":' package.json; then
    echo "  ✓ build script found"
else
    echo "  ✗ build script MISSING!"
    ERRORS=$((ERRORS + 1))
fi

# Check deploy script is executable
echo ""
echo "[4/5] Checking deploy script..."
if [ -x "deploy.sh" ]; then
    echo "  ✓ deploy.sh is executable"
else
    echo "  ! deploy.sh not executable (will fix with chmod +x)"
fi

# Check for critical server files
echo ""
echo "[5/5] Checking server files..."
if [ -f "server/index.ts" ] && [ -f "server/routes.ts" ]; then
    echo "  ✓ Server files present"
else
    echo "  ✗ Server files MISSING!"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ PACKAGE VERIFIED - READY TO DEPLOY!"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "  1. Create ZIP: zip -r ibiki-sms.zip ."
    echo "  2. Upload: scp ibiki-sms.zip root@151.243.109.79:/root/"
    echo "  3. Deploy: See DEPLOY_GUIDE.md"
    exit 0
else
    echo "❌ PACKAGE HAS $ERRORS ERROR(S)!"
    echo "========================================="
    echo ""
    echo "Fix the errors above before deploying."
    exit 1
fi
