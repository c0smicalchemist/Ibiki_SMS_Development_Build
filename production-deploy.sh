#!/bin/bash

# Ibiki SMS Production Deployment Script
# This script deploys the Ibiki SMS application to a production Linux server

set -e

echo "🚀 Starting Ibiki SMS Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="ibiki-sms"
APP_DIR="/opt/$APP_NAME"
SERVICE_USER="ibiki"
NODE_VERSION="20"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

print_status "Checking system requirements..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js $NODE_VERSION..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
    print_success "Node.js installed successfully"
else
    NODE_VER=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VER" -lt "$NODE_VERSION" ]; then
        print_warning "Node.js version $NODE_VER detected. Upgrading to version $NODE_VERSION..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y nodejs
    else
        print_success "Node.js version $(node --version) is compatible"
    fi
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2..."
    npm install -g pm2
    print_success "PM2 installed successfully"
else
    print_success "PM2 is already installed"
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    print_status "Installing PostgreSQL..."
    apt-get update
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
    print_success "PostgreSQL installed and started"
else
    print_success "PostgreSQL is already installed"
fi

# Create service user if it doesn't exist
if ! id "$SERVICE_USER" &>/dev/null; then
    print_status "Creating service user: $SERVICE_USER"
    useradd -r -s /bin/bash -d /home/$SERVICE_USER -m $SERVICE_USER
    print_success "Service user created"
else
    print_success "Service user $SERVICE_USER already exists"
fi

# Create application directory
print_status "Setting up application directory..."
mkdir -p $APP_DIR
chown $SERVICE_USER:$SERVICE_USER $APP_DIR

# Copy application files
print_status "Copying application files..."
cp -r . $APP_DIR/
chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR

# Switch to service user for the rest of the deployment
print_status "Installing dependencies as $SERVICE_USER..."
sudo -u $SERVICE_USER bash << EOF
cd $APP_DIR

# Install dependencies
npm ci --only=production

# Build the application
npm run build

# Set up environment file
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.production .env
    echo ""
    echo "⚠️  IMPORTANT: Please edit $APP_DIR/.env with your actual configuration values:"
    echo "   - DATABASE_URL (PostgreSQL connection string)"
    echo "   - JWT_SECRET (generate a secure random string)"
    echo "   - SESSION_SECRET (generate a secure random string)"
    echo "   - EXTREME_SMS_USERNAME and EXTREME_SMS_PASSWORD"
    echo ""
fi
EOF

# Set up PostgreSQL database
print_status "Setting up PostgreSQL database..."
sudo -u postgres bash << EOF
# Create database user if it doesn't exist
if ! psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$SERVICE_USER'" | grep -q 1; then
    createuser -s $SERVICE_USER
    echo "Database user $SERVICE_USER created"
else
    echo "Database user $SERVICE_USER already exists"
fi

# Create database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw $APP_NAME; then
    createdb -O $SERVICE_USER $APP_NAME
    echo "Database $APP_NAME created"
else
    echo "Database $APP_NAME already exists"
fi
EOF

# Run database migrations
print_status "Running database migrations..."
sudo -u $SERVICE_USER bash << EOF
cd $APP_DIR
npm run db:migrate
EOF

# Set up PM2 ecosystem
print_status "Setting up PM2 process management..."
sudo -u $SERVICE_USER bash << EOF
cd $APP_DIR

# Start the application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up PM2 startup script
pm2 startup
EOF

# Set up systemd service for PM2
print_status "Setting up systemd service..."
cat > /etc/systemd/system/pm2-$SERVICE_USER.service << EOF
[Unit]
Description=PM2 process manager for $SERVICE_USER
Documentation=https://pm2.keymetrics.io/
After=network.target

[Service]
Type=forking
User=$SERVICE_USER
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:$APP_DIR/node_modules/.bin
Environment=PM2_HOME=/home/$SERVICE_USER/.pm2
PIDFile=/home/$SERVICE_USER/.pm2/pm2.pid
Restart=on-failure

ExecStart=/usr/lib/node_modules/pm2/bin/pm2 resurrect
ExecReload=/usr/lib/node_modules/pm2/bin/pm2 reload all
ExecStop=/usr/lib/node_modules/pm2/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable pm2-$SERVICE_USER
systemctl start pm2-$SERVICE_USER

# Set up nginx reverse proxy (optional)
if command -v nginx &> /dev/null; then
    print_status "Setting up Nginx reverse proxy..."
    cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    print_success "Nginx reverse proxy configured"
else
    print_warning "Nginx not found. You may want to install and configure a reverse proxy."
fi

# Set up log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/$APP_NAME << EOF
/home/$SERVICE_USER/.pm2/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 $SERVICE_USER $SERVICE_USER
    postrotate
        sudo -u $SERVICE_USER pm2 reloadLogs
    endscript
}
EOF

print_success "Deployment completed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Edit $APP_DIR/.env with your actual configuration values"
echo "2. Restart the application: sudo systemctl restart pm2-$SERVICE_USER"
echo "3. Check application status: sudo -u $SERVICE_USER pm2 status"
echo "4. View logs: sudo -u $SERVICE_USER pm2 logs"
echo "5. Access your application at http://your-server-ip"
echo ""
echo "🔧 Useful Commands:"
echo "   Start:   sudo systemctl start pm2-$SERVICE_USER"
echo "   Stop:    sudo systemctl stop pm2-$SERVICE_USER"
echo "   Restart: sudo systemctl restart pm2-$SERVICE_USER"
echo "   Status:  sudo systemctl status pm2-$SERVICE_USER"
echo "   Logs:    sudo -u $SERVICE_USER pm2 logs"
echo ""
print_success "Ibiki SMS is now deployed and running!"