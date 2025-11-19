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
DEPLOY_IN_PLACE="${DEPLOY_IN_PLACE:-true}"  # Deploy from current directory by default
APP_USER="${APP_USER:-ibiki}"
APP_PORT="${APP_PORT:-5000}"  # Using 5000 as default port (browser-safe)
DOMAIN="${DOMAIN:-_}"  # Default to catch-all (IP address access)
SKIP_NGINX="${SKIP_NGINX:-false}"  # Set to 'true' if you manage Nginx manually

# Determine install directory based on deployment mode
if [ "$DEPLOY_IN_PLACE" = "true" ]; then
    INSTALL_DIR="$(pwd)"
else
    INSTALL_DIR="${INSTALL_DIR:-/opt/${APP_NAME}}"
fi

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

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# PRE-FLIGHT CHECKS - Verify required files exist
log_info "Running pre-flight checks..."

if [ ! -f "package.json" ]; then
    log_error "package.json not found in current directory!"
    log_error "Current directory: $(pwd)"
    log_error ""
    log_error "Make sure you:"
    log_error "  1. Extracted the ibiki-sms.zip file"
    log_error "  2. cd into the extracted folder"
    log_error "  3. Run: sudo ./deploy.sh"
    exit 1
fi

if [ ! -d "client" ] || [ ! -d "server" ] || [ ! -d "shared" ]; then
    log_error "Required directories (client/, server/, shared/) not found!"
    log_error "Current directory: $(pwd)"
    log_error "Files found: $(ls -la)"
    log_error ""
    log_error "Make sure you extracted ibiki-sms.zip and are in the correct folder."
    exit 1
fi

if [ ! -f "vite.config.ts" ] || [ ! -f "tsconfig.json" ]; then
    log_error "Required config files not found!"
    log_error "Make sure you have the complete project files."
    exit 1
fi

log_info "Pre-flight checks passed!"
log_info "Project files found:"
log_info "  - package.json: $(ls -lh package.json | awk '{print $5}')"
log_info "  - client/: $(find client -type f | wc -l) files"
log_info "  - server/: $(find server -type f | wc -l) files"
log_info "  - shared/: $(find shared -type f | wc -l) files"

# Step 1: System requirements check
log_info "Checking system requirements..."

# Check if port is available
if netstat -tuln 2>/dev/null | grep -q ":${APP_PORT} " || ss -tuln 2>/dev/null | grep -q ":${APP_PORT} "; then
    log_error "Port ${APP_PORT} is already in use!"
    log_warn "Use a different port: export APP_PORT=3200 && sudo ./deploy.sh"
    exit 1
fi

log_info "Port ${APP_PORT} is available"

# Step 2: Install Node.js 20+ (REQUIRED)
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_info "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    log_info "Node.js installed: $(node --version)"
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_warn "Node.js $NODE_VERSION detected. Upgrading to Node.js 20 (REQUIRED)..."
        # Remove old version
        apt-get remove -y nodejs || true
        # Install Node.js 20
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
        log_info "Node.js upgraded to: $(node --version)"
    else
        log_info "Node.js already installed: $(node --version)"
    fi
fi

# Verify Node.js 20+
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    log_error "Node.js 20+ is required, but version $(node --version) is installed"
    log_error "Please install Node.js 20 manually and try again"
    exit 1
fi
log_info "Node.js version verified: $(node --version)"

# Step 3: Create application user
log_info "Setting up application user..."
if ! id -u "$APP_USER" &>/dev/null; then
    useradd -r -m -s /bin/bash "$APP_USER"
    log_info "Created user: $APP_USER"
else
    log_info "User $APP_USER already exists"
fi

# Step 4: Prepare application directory
if [ "$DEPLOY_IN_PLACE" = "true" ]; then
    log_info "Deploying in place from $SCRIPT_DIR..."
    INSTALL_DIR="$SCRIPT_DIR"
    cd "$INSTALL_DIR"
    
    # Clean up unnecessary files
    log_info "Cleaning up unnecessary files..."
    rm -rf .git .cache node_modules/.cache 2>/dev/null || true
    
    log_info "Using current directory: $INSTALL_DIR"
else
    log_info "Installing application to $INSTALL_DIR..."
    
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "Backing up existing installation..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}.backup.$(date +%s)"
    fi
    
    mkdir -p "$INSTALL_DIR"
    
    # Copy all files from current directory to install directory
    log_info "Copying files from $SCRIPT_DIR to $INSTALL_DIR..."
    cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/" 2>/dev/null || {
        log_error "Failed to copy files!"
        exit 1
    }
    
    # Also copy hidden files if they exist
    cp -r "$SCRIPT_DIR"/.??* "$INSTALL_DIR/" 2>/dev/null || true
    
    cd "$INSTALL_DIR"
    
    # Remove unnecessary files to save space
    rm -rf .git .cache 2>/dev/null || true
    
    log_info "Files copied successfully"
fi

# Verify critical files exist
if [ ! -f "$INSTALL_DIR/package.json" ]; then
    log_error "Installation failed - package.json not found in $INSTALL_DIR"
    exit 1
fi

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

# Step 7: Configure npm for app user to use local directories
log_info "Configuring npm to use local directories..."
APP_HOME="$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/.npm-cache" "$INSTALL_DIR/.npm-global" "$INSTALL_DIR/.npm-tmp"

# Create .npmrc for app user pointing to local directories
cat > "$INSTALL_DIR/.npmrc" << EOF
prefix=$INSTALL_DIR/.npm-global
cache=$INSTALL_DIR/.npm-cache
tmp=$INSTALL_DIR/.npm-tmp
EOF

chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR/.npm-cache" "$INSTALL_DIR/.npm-global" "$INSTALL_DIR/.npm-tmp" "$INSTALL_DIR/.npmrc"

# Step 8: Install dependencies and build
log_info "Installing dependencies..."
cd "$INSTALL_DIR"

# Use env to preserve npm config through sudo
sudo -u "$APP_USER" env HOME="$APP_HOME" npm_config_userconfig="$APP_HOME/.npmrc" npm_config_cache="$APP_HOME/.npm-cache" npm_config_prefix="$APP_HOME/.npm-global" npm ci --production=false

log_info "Building application..."
# Frontend build
log_info "Building frontend with Vite..."
sudo -u "$APP_USER" env HOME="$APP_HOME" npm_config_userconfig="$APP_HOME/.npmrc" npm_config_cache="$APP_HOME/.npm-cache" npm_config_prefix="$APP_HOME/.npm-global" npx vite build

# Backend build with proper external exclusions
log_info "Building backend with esbuild..."
sudo -u "$APP_USER" env HOME="$APP_HOME" npm_config_userconfig="$APP_HOME/.npmrc" npm_config_cache="$APP_HOME/.npm-cache" npm_config_prefix="$APP_HOME/.npm-global" npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --external:vite \
  --external:@vitejs/* \
  --external:@replit/* \
  --outdir=dist

# Verify builds
if [ ! -d "$INSTALL_DIR/dist/public" ]; then
    log_error "Frontend build failed - dist/public not found"
    exit 1
fi

if [ ! -f "$INSTALL_DIR/dist/index.js" ]; then
    log_error "Backend build failed - dist/index.js not found"
    exit 1
fi

log_info "Build successful!"
log_info "  - Frontend: dist/public/"
log_info "  - Backend: dist/index.js"

# Step 9: Install PM2 globally if not present
log_info "Checking PM2 installation..."
if ! command -v pm2 &> /dev/null; then
    log_info "Installing PM2..."
    npm install -g pm2
else
    log_info "PM2 already installed, skipping..."
fi

# Step 10: Set up PM2 ecosystem file
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
# Set PM2_HOME to user's home directory to avoid permission issues
PM2_HOME="/home/$APP_USER/.pm2"
mkdir -p "$PM2_HOME"
chown -R "$APP_USER:$APP_USER" "$PM2_HOME"

sudo -u "$APP_USER" env PM2_HOME="$PM2_HOME" pm2 delete "$APP_NAME" 2>/dev/null || true
sudo -u "$APP_USER" env PM2_HOME="$PM2_HOME" pm2 start "$INSTALL_DIR/ecosystem.config.cjs"

# Set up PM2 to start on boot
log_info "Configuring PM2 startup..."
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null || true
sudo -u "$APP_USER" env PM2_HOME="$PM2_HOME" pm2 save

# Wait a moment for PM2 to start the app
sleep 2

# Check if app is running
if sudo -u "$APP_USER" env PM2_HOME="$PM2_HOME" pm2 list | grep -q "$APP_NAME.*online"; then
    log_info "Application started successfully!"
else
    log_error "Application failed to start!"
    log_error "Check logs with: PM2_HOME=/home/$APP_USER/.pm2 pm2 logs $APP_NAME"
    exit 1
fi

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
    
    # Determine server_name based on DOMAIN
    if [ "$DOMAIN" = "_" ]; then
        SERVER_NAME="_"
        log_info "Configuring Nginx for IP address access (no domain)"
    else
        SERVER_NAME="${DOMAIN}"
        log_info "Configuring Nginx for domain: ${DOMAIN}"
    fi
    
    cat > "/etc/nginx/sites-available/${APP_NAME}" << EOF
server {
    listen 80 default_server;
    server_name ${SERVER_NAME};

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

    # Remove default Nginx site to avoid conflicts
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

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
echo "  - Port: ${APP_PORT} (internal)"
echo "  - Directory: ${INSTALL_DIR}"
echo "  - User: ${APP_USER}"
echo ""
echo "Access your application:"
if [ "$SKIP_NGINX" != "true" ]; then
    echo "  - Via IP: http://YOUR_SERVER_IP"
    if [ "$DOMAIN" != "_" ]; then
        echo "  - Via Domain: http://${DOMAIN}"
    fi
    echo "  - Direct Port: http://YOUR_SERVER_IP:${APP_PORT}"
else
    echo "  - Local: http://localhost:${APP_PORT}"
    echo "  - Public: http://YOUR_SERVER_IP:${APP_PORT}"
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
echo ""
if [ "$DEPLOY_IN_PLACE" = "true" ]; then
    echo "NOTE: Application deployed in place from: ${INSTALL_DIR}"
    echo "To deploy to /opt instead, use: DEPLOY_IN_PLACE=false sudo ./deploy.sh"
fi
echo "================================="
