#!/bin/bash

# Ibiki SMS Production Deployment Script
# This script deploys the Ibiki SMS application on a Linux server

set -e  # Exit on any error

echo "🚀 Starting Ibiki SMS Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider using a non-root user for security."
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found!"
    print_status "Please copy .env.example to .env and configure your environment variables:"
    print_status "cp .env.example .env"
    print_status "nano .env"
    exit 1
fi

# Check Node.js version
print_status "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi
print_success "Node.js version: $(node -v)"

# Check if PM2 is installed
print_status "Checking PM2..."
if ! command -v pm2 &> /dev/null; then
    print_status "Installing PM2 globally..."
    npm install -g pm2
fi
print_success "PM2 is available"

# Install dependencies
print_status "Installing dependencies..."
npm ci --only=production

# Build the application
print_status "Building application..."
npm run build

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs

# Stop existing PM2 processes
print_status "Stopping existing PM2 processes..."
pm2 stop ibiki-sms 2>/dev/null || true
pm2 delete ibiki-sms 2>/dev/null || true

# Start the application with PM2
print_status "Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
print_status "Saving PM2 configuration..."
pm2 save

# Setup PM2 startup script
print_status "Setting up PM2 startup script..."
pm2 startup

print_success "🎉 Deployment completed successfully!"
print_status "Application is running on port 5000"
print_status "Use 'pm2 status' to check application status"
print_status "Use 'pm2 logs ibiki-sms' to view logs"
print_status "Use 'pm2 restart ibiki-sms' to restart the application"

echo ""
print_status "📋 Next steps:"
print_status "1. Configure your reverse proxy (nginx/apache) to point to port 5000"
print_status "2. Set up SSL certificates"
print_status "3. Configure your firewall"
print_status "4. Test the application"