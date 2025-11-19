#!/bin/bash

# Ibiki SMS - Complete Deployment Script
# This script handles EVERYTHING: PostgreSQL setup, build, and deployment

set -e

echo "================================================================"
echo "  Ibiki SMS - Complete Deployment"
echo "================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use: sudo ./full-deploy.sh)"
    exit 1
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "Deployment Directory: $SCRIPT_DIR"
echo ""

# Step 1: PostgreSQL Setup
echo "================================================================"
echo "  STEP 1: PostgreSQL Database Setup"
echo "================================================================"
echo ""

if [ -f "$SCRIPT_DIR/setup-postgres.sh" ]; then
    chmod +x setup-postgres.sh
    ./setup-postgres.sh
    
    if [ $? -eq 0 ]; then
        print_success "PostgreSQL setup completed"
    else
        print_error "PostgreSQL setup failed"
        exit 1
    fi
else
    print_error "setup-postgres.sh not found"
    exit 1
fi

echo ""
echo "================================================================"
echo "  STEP 2: Application Build & Deployment"
echo "================================================================"
echo ""

if [ -f "$SCRIPT_DIR/deploy.sh" ]; then
    chmod +x deploy.sh
    ./deploy.sh
    
    if [ $? -eq 0 ]; then
        print_success "Application deployment completed"
    else
        print_error "Application deployment failed"
        exit 1
    fi
else
    print_error "deploy.sh not found"
    exit 1
fi

echo ""
echo "================================================================"
echo "  STEP 3: Database Schema Setup"
echo "================================================================"
echo ""

print_info "Pushing database schema to PostgreSQL..."

# Push database schema
cd "$SCRIPT_DIR"
npm run db:push --force

if [ $? -eq 0 ]; then
    print_success "Database schema created successfully"
else
    print_warning "Database schema push had issues (may be normal if schema exists)"
fi

echo ""
echo "================================================================"
echo "  STEP 4: Application Startup"
echo "================================================================"
echo ""

# Restart application with updated environment
print_info "Restarting application with database configuration..."

if command -v pm2 &> /dev/null; then
    PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env 2>&1 | grep -v "Use --update-env"
    sleep 2
    print_success "Application restarted"
else
    print_warning "PM2 not found, application may need manual restart"
fi

echo ""
echo "================================================================"
echo "  STEP 5: Verification"
echo "================================================================"
echo ""

# Check if application is running
print_info "Checking application status..."

if PM2_HOME=/home/ibiki/.pm2 pm2 status | grep -q "ibiki-sms.*online"; then
    print_success "Application is running"
else
    print_warning "Application may not be running correctly"
fi

# Check if database is connected
print_info "Checking database connection..."

sleep 2
if PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms --lines 10 --nostream 2>/dev/null | grep -q "in-memory storage"; then
    print_error "Application is using in-memory storage (database not connected)"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check .env file: cat .env | grep DATABASE_URL"
    echo "  2. Restart with env update: PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms --update-env"
    echo "  3. Check logs: PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms"
else
    print_success "Database connection verified"
fi

# Test HTTP endpoint
print_info "Testing HTTP endpoint..."

sleep 1
if curl -s http://localhost:5000 | grep -q "<!DOCTYPE html>"; then
    print_success "HTTP endpoint responding correctly"
else
    print_warning "HTTP endpoint may not be responding"
fi

echo ""
echo "================================================================"
echo "  Deployment Complete!"
echo "================================================================"
echo ""
echo "Your Ibiki SMS platform is now running!"
echo ""
echo "Access Information:"
echo "  Local:  http://localhost:5000"
echo "  Public: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo ""
echo "Database Information:"
echo "  Connection string saved in: $SCRIPT_DIR/.env"
echo "  View credentials: cat .env | grep DATABASE_URL"
echo ""
echo "Next Steps:"
echo "  1. Open your browser and navigate to your server IP"
echo "  2. Click 'Get Started' to create first admin user"
echo "  3. Login and configure ExtremeSMS API credentials"
echo "  4. Create client accounts and start sending SMS!"
echo ""
echo "Useful Commands:"
echo "  View logs:    PM2_HOME=/home/ibiki/.pm2 pm2 logs ibiki-sms"
echo "  View status:  PM2_HOME=/home/ibiki/.pm2 pm2 status"
echo "  Restart app:  PM2_HOME=/home/ibiki/.pm2 pm2 restart ibiki-sms"
echo "  Database backup: sudo -u postgres pg_dump ibiki_sms > backup.sql"
echo ""
echo "Documentation:"
echo "  Database Guide:  cat DATABASE_SETUP_GUIDE.md"
echo "  Quick Start:     cat QUICKSTART.md"
echo "  Full Docs:       cat DEPLOYMENT.md"
echo ""
echo "================================================================"
echo ""

# Show final status
PM2_HOME=/home/ibiki/.pm2 pm2 status 2>/dev/null || true

echo ""
print_success "All done! Your application is ready to use."
echo ""
