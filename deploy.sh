#!/bin/bash

# Ibiki SMS - 1-Click Deployment Script
# This script deploys the Ibiki SMS API middleware application to your server

set -e  # Exit on any error

echo "================================="
echo "Ibiki SMS Deployment Script"
echo "================================="
echo ""

# Configuration
APP_NAME="ibiki-sms"
INSTALL_DIR="/opt/${APP_NAME}"
APP_USER="${APP_USER:-ibiki}"
APP_PORT="${APP_PORT:-3100}"  # Using 3100 to avoid conflict with common port 3000
DOMAIN="${DOMAIN:-api.ibikisms.com}"
SKIP_NGINX="${SKIP_NGINX:-false}"  # Set to 'true' if you manage Nginx manually

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "Please run as root (use sudo)"
    exit 1
fi

# Step 1: System requirements check
log_info "Checking system requirements..."

# Check if port is available
if netstat -tuln 2>/dev/null | grep -q ":${APP_PORT} " || ss -tuln 2>/dev/null | grep -q ":${APP_PORT} "; then
    log_error "Port ${APP_PORT} is already in use!"
    log_warn "Use a different port: export APP_PORT=3200 && sudo ./deploy.sh"
    exit 1
fi

log_info "Port ${APP_PORT} is available"

# Step 2: Install Node.js if not present
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_info "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_info "Node.js installed: $(node --version)"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_warn "Node.js version is too old. Installing Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    else
        log_info "Node.js already installed: $(node --version)"
    fi
fi

# Step 3: Create application user
log_info "Setting up application user..."
if ! id -u "$APP_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$APP_USER"
    log_info "Created user: $APP_USER"
else
    log_info "User $APP_USER already exists"
fi

# Step 4: Copy application files
log_info "Installing application to $INSTALL_DIR..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

if [ -d "$INSTALL_DIR" ]; then
    log_warn "Backing up existing installation..."
    mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
fi

mkdir -p "$INSTALL_DIR"
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/" 2>/dev/null || cp -r ./* "$INSTALL_DIR/"
cd "$INSTALL_DIR"

# Remove .git directory to save space
rm -rf .git

# Step 5: Create .env file
if [ ! -f "$INSTALL_DIR/.env" ]; then
    log_info "Creating environment configuration..."
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat > "$INSTALL_DIR/.env" << EOF
# Ibiki SMS Configuration
NODE_ENV=production
PORT=${APP_PORT}
HOST=0.0.0.0

# Security
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${JWT_SECRET}

# Logging
LOG_LEVEL=info
EOF

    log_warn "Please update the .env file with your ExtremeSMS API key"
else
    log_info ".env file already exists, skipping..."
fi

# Step 6: Set permissions
log_info "Setting file permissions..."
chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
chmod 600 "$INSTALL_DIR/.env"

# Step 7: Install dependencies and build
log_info "Installing dependencies..."
cd "$INSTALL_DIR"
sudo -u "$APP_USER" npm ci --production=false

log_info "Building application..."
# Build both frontend and backend
# The npm build script handles both vite build (frontend) and esbuild (backend)
# We override the backend build with proper externals
sudo -u "$APP_USER" npm run build 2>&1 | tail -20 || {
    log_warn "Standard build had issues, trying custom build..."
    # Frontend build
    sudo -u "$APP_USER" npx vite build
    # Backend build with proper external exclusions
    sudo -u "$APP_USER" npx esbuild server/index.ts \
      --platform=node \
      --packages=external \
      --bundle \
      --format=esm \
      --external:vite \
      --external:@vitejs/* \
      --external:@replit/* \
      --outdir=dist
}

# Verify build
if [ ! -f "$INSTALL_DIR/dist/index.js" ]; then
    log_error "Build failed - dist/index.js not found"
    exit 1
fi

log_info "Build successful!"

# Step 8: Install PM2 globally if not present
log_info "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    log_info "Installing PM2..."
    npm install -g pm2
else
    log_info "PM2 already installed, skipping..."
fi

# Step 9: Set up PM2 ecosystem file
log_info "Creating PM2 ecosystem configuration..."
cat > "$INSTALL_DIR/ecosystem.config.cjs" << EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: './dist/index.js',
    cwd: '${INSTALL_DIR}',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/var/log/${APP_NAME}/error.log',
    out_file: '/var/log/${APP_NAME}/out.log',
    log_file: '/var/log/${APP_NAME}/combined.log',
    time: true
  }]
};
EOF

# Create log directory
mkdir -p "/var/log/${APP_NAME}"
chown "$APP_USER:$APP_USER" "/var/log/${APP_NAME}"

# Step 10: Start application with PM2
log_info "Starting application with PM2..."
sudo -u "$APP_USER" pm2 delete "$APP_NAME" 2>/dev/null || true
sudo -u "$APP_USER" pm2 start "$INSTALL_DIR/ecosystem.config.cjs"

# Set up PM2 to start on boot
log_info "Configuring PM2 startup..."
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null || true
sudo -u "$APP_USER" pm2 save

# Step 11: Install and configure Nginx
if [ "$SKIP_NGINX" != "true" ]; then
    log_info "Checking Nginx installation..."
    if ! command -v nginx &> /dev/null; then
        log_info "Installing Nginx..."
        apt-get update
        apt-get install -y nginx
    else
        log_info "Nginx already installed, skipping..."
    fi

    # Step 12: Create Nginx configuration
    log_info "Creating Nginx configuration..."
    cat > "/etc/nginx/sites-available/${APP_NAME}" << EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # Increase client body size for file uploads
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

    # Enable site
    ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
    
    # Test Nginx configuration
    if nginx -t 2>/dev/null; then
        log_info "Nginx configuration valid"
        systemctl reload nginx
    else
        log_error "Nginx configuration invalid"
        log_warn "Please check /etc/nginx/sites-available/${APP_NAME}"
    fi
else
    log_info "Skipping Nginx configuration (SKIP_NGINX=true)"
fi

echo ""
echo "================================="
echo "Deployment Complete!"
echo "================================="
echo ""
log_info "Application deployed successfully!"
echo ""
echo "Service Information:"
echo "  - Name: ${APP_NAME}"
echo "  - Port: ${APP_PORT}"
echo "  - Directory: ${INSTALL_DIR}"
echo "  - User: ${APP_USER}"
echo ""
echo "Access your application:"
echo "  - Local: http://localhost:${APP_PORT}"
echo "  - Public IP: http://YOUR_SERVER_IP:${APP_PORT}"
if [ "$SKIP_NGINX" != "true" ]; then
    echo "  - Domain: http://${DOMAIN}"
fi
echo ""
echo "Useful commands:"
echo "  - View logs: pm2 logs ${APP_NAME}"
echo "  - Restart: pm2 restart ${APP_NAME}"
echo "  - Status: pm2 status"
echo "  - Monitor: pm2 monit"
echo ""
echo "Next steps:"
echo "  1. Visit your application in a browser"
echo "  2. Create your admin account (first user is auto-admin)"
echo "  3. Configure ExtremeSMS API key in Admin Dashboard"
if [ "$SKIP_NGINX" != "true" ]; then
    echo "  4. Set up SSL: sudo certbot --nginx -d ${DOMAIN}"
fi
echo ""
echo "Configuration file: ${INSTALL_DIR}/.env"
echo "================================="
