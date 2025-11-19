#!/bin/bash

# Ibiki SMS - Deployment Fix Script
# Run this on your server to fix the build issues

set -e

echo "================================="
echo "Ibiki SMS - Deployment Fix"
echo "================================="
echo ""

# Navigate to the application directory
cd /root/IbikiGateway || { echo "Error: IbikiGateway folder not found!"; exit 1; }

echo "[1/6] Updating build configuration..."

# Fix the build script in package.json
cat > package.json.tmp << 'EOF'
{
  "name": "rest-express",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --external:vite --external:@vitejs/* --external:@replit/* --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@jridgewell/trace-mapping": "^0.3.25",
    "@neondatabase/serverless": "^0.10.4",
    "@radix-ui/react-accordion": "^1.2.4",
    "@radix-ui/react-alert-dialog": "^1.1.7",
    "@radix-ui/react-aspect-ratio": "^1.1.3",
    "@radix-ui/react-avatar": "^1.1.4",
    "@radix-ui/react-checkbox": "^1.1.5",
    "@radix-ui/react-collapsible": "^1.1.4",
    "@radix-ui/react-context-menu": "^2.2.7",
    "@radix-ui/react-dialog": "^1.1.7",
    "@radix-ui/react-dropdown-menu": "^2.1.7",
    "@radix-ui/react-hover-card": "^1.1.7",
    "@radix-ui/react-label": "^2.1.3",
    "@radix-ui/react-menubar": "^1.1.7",
    "@radix-ui/react-navigation-menu": "^1.2.6",
    "@radix-ui/react-popover": "^1.1.7",
    "@radix-ui/react-progress": "^1.1.3",
    "@radix-ui/react-radio-group": "^1.2.4",
    "@radix-ui/react-scroll-area": "^1.2.4",
    "@radix-ui/react-select": "^2.1.7",
    "@radix-ui/react-separator": "^1.1.3",
    "@radix-ui/react-slider": "^1.2.4",
    "@radix-ui/react-slot": "^1.2.0",
    "@radix-ui/react-switch": "^1.1.4",
    "@radix-ui/react-tabs": "^1.1.4",
    "@radix-ui/react-toast": "^1.2.7",
    "@radix-ui/react-toggle": "^1.1.3",
    "@radix-ui/react-toggle-group": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.2.0",
    "@tanstack/react-query": "^5.60.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.10",
    "axios": "^1.13.2",
    "bcryptjs": "^3.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "connect-pg-simple": "^10.0.0",
    "date-fns": "^3.6.0",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0",
    "embla-carousel-react": "^8.6.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "framer-motion": "^11.13.1",
    "input-otp": "^1.4.2",
    "jsonwebtoken": "^9.0.2",
    "lucide-react": "^0.453.0",
    "memorystore": "^1.6.7",
    "next-themes": "^0.4.6",
    "passport": "^0.7.0",
    "passport-local": "^1.0.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.55.0",
    "react-icons": "^5.4.0",
    "react-resizable-panels": "^2.1.7",
    "recharts": "^2.15.2",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.2.5",
    "vaul": "^1.1.2",
    "wouter": "^3.3.5",
    "ws": "^8.18.0",
    "zod": "^3.24.2",
    "zod-validation-error": "^3.4.0"
  },
  "devDependencies": {
    "@replit/vite-plugin-cartographer": "^0.4.2",
    "@replit/vite-plugin-dev-banner": "^0.1.1",
    "@replit/vite-plugin-runtime-error-modal": "^0.0.3",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.3",
    "@types/connect-pg-simple": "^7.0.3",
    "@types/express": "4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/node": "20.16.11",
    "@types/passport": "^1.0.16",
    "@types/passport-local": "^1.0.38",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@types/ws": "^8.5.13",
    "@vitejs/plugin-react": "^4.7.0",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.31.4",
    "esbuild": "^0.25.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "tsx": "^4.20.5",
    "typescript": "5.6.3",
    "vite": "^5.4.20"
  },
  "optionalDependencies": {
    "bufferutil": "^4.0.8"
  }
}
EOF

mv package.json.tmp package.json

echo "[2/6] Installing dependencies..."
npm ci --production=false

echo "[3/6] Building frontend..."
npm run build 2>&1 | head -20

echo "[4/6] Checking build output..."
if [ -f "dist/index.js" ]; then
    echo "✓ Build successful!"
    ls -lh dist/index.js
else
    echo "✗ Build failed - dist/index.js not found"
    exit 1
fi

echo "[5/6] Installing to /opt/ibiki-sms..."
# Create application user if doesn't exist
if ! id -u ibiki &>/dev/null; then
    useradd -r -s /bin/false ibiki
    echo "✓ Created ibiki user"
fi

# Copy to /opt
rm -rf /opt/ibiki-sms
mkdir -p /opt/ibiki-sms
cp -r * /opt/ibiki-sms/
chown -R ibiki:ibiki /opt/ibiki-sms

# Create .env if doesn't exist
if [ ! -f /opt/ibiki-sms/.env ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    cat > /opt/ibiki-sms/.env << ENVEOF
NODE_ENV=production
PORT=3100
HOST=0.0.0.0
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${JWT_SECRET}
LOG_LEVEL=info
ENVEOF
    chmod 600 /opt/ibiki-sms/.env
    chown ibiki:ibiki /opt/ibiki-sms/.env
    echo "✓ Created .env file"
fi

echo "[6/6] Starting with PM2..."
# Install PM2 if not present
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo "✓ Installed PM2"
fi

# Create ecosystem config
cat > /opt/ibiki-sms/ecosystem.config.cjs << 'ECOEOF'
module.exports = {
  apps: [{
    name: 'ibiki-sms',
    script: './dist/index.js',
    cwd: '/opt/ibiki-sms',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/ibiki-sms/error.log',
    out_file: '/var/log/ibiki-sms/out.log',
    log_file: '/var/log/ibiki-sms/combined.log',
    time: true
  }]
};
ECOEOF

# Create log directory
mkdir -p /var/log/ibiki-sms
chown ibiki:ibiki /var/log/ibiki-sms

# Stop old instance if running
pm2 delete ibiki-sms 2>/dev/null || true

# Start application
cd /opt/ibiki-sms
sudo -u ibiki pm2 start ecosystem.config.cjs
sudo -u ibiki pm2 save

echo ""
echo "================================="
echo "✓ Deployment Complete!"
echo "================================="
echo ""
echo "Application Status:"
pm2 list
echo ""
echo "Test the application:"
echo "  curl http://localhost:3100"
echo ""
echo "View logs:"
echo "  pm2 logs ibiki-sms"
echo ""
echo "Next steps:"
echo "1. Configure Nginx (if needed)"
echo "2. Set up SSL with certbot"
echo "3. Create admin account"
echo "================================="
