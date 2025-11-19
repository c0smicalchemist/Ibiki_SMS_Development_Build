#!/bin/bash

# Ibiki SMS - PostgreSQL Setup Script
# This script installs and configures PostgreSQL locally on the server

set -e

echo "================================================================"
echo "  Ibiki SMS - PostgreSQL Database Setup"
echo "================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

echo "Step 1: Installing PostgreSQL..."
echo "--------------------------------"

# Check if PostgreSQL is already installed
if command -v psql &> /dev/null; then
    print_warning "PostgreSQL is already installed"
    PSQL_VERSION=$(psql --version | awk '{print $3}')
    echo "   Version: $PSQL_VERSION"
else
    # Update package list
    apt update -qq

    # Install PostgreSQL
    DEBIAN_FRONTEND=noninteractive apt install -y postgresql postgresql-contrib > /dev/null 2>&1
    
    print_success "PostgreSQL installed successfully"
fi

echo ""
echo "Step 2: Starting PostgreSQL service..."
echo "---------------------------------------"

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql > /dev/null 2>&1

# Check if service is running
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL service is running"
else
    print_error "Failed to start PostgreSQL service"
    exit 1
fi

echo ""
echo "Step 3: Creating database and user..."
echo "--------------------------------------"

# Database credentials (configured for deployment)
DB_PASSWORD="c0smic4382"
DB_NAME="ibiki_sms"
DB_USER="admin"

# Create database and user
sudo -u postgres psql << EOF > /dev/null 2>&1
-- Drop existing database and user if they exist
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;

-- Create new database and user
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to database and grant schema permissions
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;
EOF

if [ $? -eq 0 ]; then
    print_success "Database '$DB_NAME' created"
    print_success "User '$DB_USER' created"
else
    print_error "Failed to create database or user"
    exit 1
fi

echo ""
echo "Step 4: Configuring database connection..."
echo "-------------------------------------------"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    print_warning ".env file not found, creating from .env.example"
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    else
        print_error ".env.example not found"
        exit 1
    fi
fi

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"

# Remove any existing DATABASE_URL line
sed -i '/^DATABASE_URL=/d' "$SCRIPT_DIR/.env"

# Add new DATABASE_URL
echo "" >> "$SCRIPT_DIR/.env"
echo "# PostgreSQL Database (auto-configured by setup-postgres.sh)" >> "$SCRIPT_DIR/.env"
echo "DATABASE_URL=$DATABASE_URL" >> "$SCRIPT_DIR/.env"

print_success "Database connection configured in .env"

echo ""
echo "Step 5: Testing database connection..."
echo "---------------------------------------"

# Test connection
if sudo -u postgres psql -d $DB_NAME -U $DB_USER -h localhost -c "SELECT 1;" > /dev/null 2>&1; then
    print_success "Database connection test successful"
else
    print_warning "Database connection test failed (may require password auth)"
fi

echo ""
echo "Step 6: Configuring PostgreSQL authentication..."
echo "-------------------------------------------------"

# Find PostgreSQL version directory
PG_VERSION=$(ls /etc/postgresql/ | head -n 1)
PG_HBA_FILE="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

if [ -f "$PG_HBA_FILE" ]; then
    # Backup original file
    cp "$PG_HBA_FILE" "$PG_HBA_FILE.backup"
    
    # Update authentication method for local connections
    sed -i 's/^local\s\+all\s\+all\s\+peer/local   all             all                                     md5/' "$PG_HBA_FILE"
    
    # Reload PostgreSQL configuration
    systemctl reload postgresql
    
    print_success "PostgreSQL authentication configured"
else
    print_warning "Could not find pg_hba.conf file"
fi

echo ""
echo "================================================================"
echo "  PostgreSQL Setup Complete!"
echo "================================================================"
echo ""
echo "Database Information:"
echo "  Database Name: $DB_NAME"
echo "  Username:      $DB_USER"
echo "  Password:      $DB_PASSWORD"
echo "  Host:          localhost"
echo "  Port:          5432"
echo ""
echo "Connection String (saved to .env):"
echo "  $DATABASE_URL"
echo ""
print_success "Database credentials saved to .env file"
echo ""
echo "⚠️  IMPORTANT: Save the password above in a secure location!"
echo "    The password is stored in: $SCRIPT_DIR/.env"
echo ""
echo "Next Steps:"
echo "  1. Run deployment script: sudo ./deploy.sh"
echo "  2. Push database schema: npm run db:push --force"
echo "  3. Restart application: PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env"
echo ""
echo "================================================================"
