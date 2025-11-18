#!/bin/bash

# Yubin Dash - 1-Click Deployment Script
# This script deploys the Yubin Dash SMS API middleware application to your server

set -e  # Exit on any error

echo "================================="
echo "Yubin Dash Deployment Script"
echo "================================="
echo ""

# Configuration
APP_NAME="yubin-dash"
INSTALL_DIR="/opt/${APP_NAME}"
APP_USER="${APP_USER:-yubin}"
APP_PORT="${APP_PORT:-3000}"
DOMAIN="${DOMAIN:-api.yubindash.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    log_error "Please run as root (use sudo)"
    exit 1
fi

# Step 1: Install Node.js 20 if not present
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_info "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_warn "Node.js version is too old. Upgrading..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
fi

log_info "Node.js version: $(node -v)"
log_info "npm version: $(npm -v)"

# Step 2: Create application user if it doesn't exist
if ! id "$APP_USER" &>/dev/null; then
    log_info "Creating application user: $APP_USER"
    useradd -r -s /bin/bash -d "$INSTALL_DIR" "$APP_USER"
else
    log_info "User $APP_USER already exists"
fi

# Step 3: Create installation directory
log_info "Creating installation directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Step 4: Copy application files
log_info "Copying application files..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Copy all files except node_modules and build artifacts
rsync -av --exclude='node_modules' \
          --exclude='dist' \
          --exclude='.git' \
          --exclude='deploy.sh' \
          --exclude='*.md' \
          "$SCRIPT_DIR/" "$INSTALL_DIR/"

# Step 5: Set up environment file if it doesn't exist
if [ ! -f "$INSTALL_DIR/.env" ]; then
    log_info "Creating .env file from template..."
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -hex 32)
    
    cat > "$INSTALL_DIR/.env" << EOF
# Yubin Dash Configuration
NODE_ENV=production
PORT=${APP_PORT}
HOST=0.0.0.0

# Security
JWT_SECRET=${JWT_SECRET}
SESSION_SECRET=${JWT_SECRET}

# ExtremeSMS Configuration (set via admin panel after deployment)
EXTREMESMS_API_KEY=
EXTREMESMS_BASE_URL=https://extremesms.net

# Pricing (can be changed in admin panel)
DEFAULT_EXTREME_COST=0.01
DEFAULT_CLIENT_RATE=0.02

# Server Configuration
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
sudo -u "$APP_USER" npm run build

# Step 8: Install PM2 globally if not present
log_info "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    log_info "Installing PM2..."
    npm install -g pm2
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
pm2 startup systemd -u "$APP_USER" --hp "$INSTALL_DIR"
sudo -u "$APP_USER" pm2 save

# Step 11: Install and configure Nginx
log_info "Checking Nginx installation..."
if ! command -v nginx &> /dev/null; then
    log_info "Installing Nginx..."
    apt-get update
    apt-get install -y nginx
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
ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/"

# Test Nginx configuration
log_info "Testing Nginx configuration..."
nginx -t

# Reload Nginx
log_info "Reloading Nginx..."
systemctl reload nginx
systemctl enable nginx

# Step 13: Set up firewall (if UFW is installed)
if command -v ufw &> /dev/null; then
    log_info "Configuring firewall..."
    ufw allow 'Nginx Full' 2>/dev/null || true
fi

echo ""
echo "================================="
echo "Deployment Complete!"
echo "================================="
echo ""
log_info "Application is running at: http://${DOMAIN}"
log_info "Application is also accessible at: http://$(hostname -I | awk '{print $1}')"
echo ""
log_info "Next steps:"
echo "  1. Point your domain ${DOMAIN} to this server's IP address"
echo "  2. Set up SSL with: sudo certbot --nginx -d ${DOMAIN}"
echo "  3. Access admin panel at: http://${DOMAIN}/admin"
echo "  4. Configure ExtremeSMS API key in admin panel"
echo ""
log_info "Useful commands:"
echo "  - View logs: pm2 logs ${APP_NAME}"
echo "  - Restart app: pm2 restart ${APP_NAME}"
echo "  - Stop app: pm2 stop ${APP_NAME}"
echo "  - App status: pm2 status"
echo ""
log_warn "Remember to update .env file at: ${INSTALL_DIR}/.env"
echo ""
