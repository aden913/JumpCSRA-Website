#!/bin/bash

# JumpCSRA Deployment Script for Linode
echo "🚀 Starting JumpCSRA deployment..."

# Set deployment directory
DEPLOY_DIR="/var/www/jumpcsra"
BACKUP_DIR="/var/www/jumpcsra-backup-$(date +%Y%m%d-%H%M%S)"

# Backup current deployment if it exists
if [ -d "$DEPLOY_DIR" ]; then
    echo "📦 Creating backup of current deployment..."
    sudo cp -r $DEPLOY_DIR $BACKUP_DIR
fi

# Stop PM2 processes
echo "🛑 Stopping PM2 processes..."
pm2 delete all 2>/dev/null || true

# Create directory if it doesn't exist
sudo mkdir -p $DEPLOY_DIR

# Pull latest changes from Git
echo "📥 Pulling latest changes from Git..."
cd $DEPLOY_DIR
if [ -d ".git" ]; then
    # Clean any local changes and pull fresh
    sudo git clean -fd
    sudo git reset --hard HEAD
    sudo git pull origin main
else
    # Clone repository if it doesn't exist
    cd /var/www
    sudo rm -rf jumpcsra
    sudo git clone https://github.com/aden913/JumpCSRA-Website.git jumpcsra
    cd jumpcsra
fi

# Set permissions
sudo chown -R $USER:$USER $DEPLOY_DIR

# Install serverFiles dependencies
echo "📦 Installing backend dependencies..."
cd $DEPLOY_DIR/serverFiles
npm install --production

# Build React app
echo "🔨 Building React application..."
cd $DEPLOY_DIR/JumpCSRA
npm install
npm run build

# Setup environment file
echo "⚙️ Setting up environment..."
cd $DEPLOY_DIR/serverFiles
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp env.template .env
    echo "⚠️  IMPORTANT: Edit .env file with your actual credentials!"
    echo "   1. Get SendGrid API key from: https://app.sendgrid.com/settings/api_keys"
    echo "   2. Get Firebase credentials from Firebase Console > Project Settings > Service Accounts"
fi

# Create logs directory with proper permissions
echo "📁 Setting up logs directory..."
mkdir -p $DEPLOY_DIR/serverFiles/logs
chmod 755 $DEPLOY_DIR/serverFiles/logs

# Start with PM2
echo "🔄 Starting server with PM2..."
cd $DEPLOY_DIR
pm2 start ecosystem.config.js
pm2 save

echo "✅ Deployment complete!"
echo "🌐 Server should be running on port 3000"
echo "📝 Don't forget to:"
echo "   1. Edit $DEPLOY_DIR/serverFiles/.env with your credentials"
echo "   2. Set up Nginx reverse proxy if needed"
echo "   3. Configure SSL certificate"
echo ""
echo "🔍 Check status with: pm2 list"
echo "📄 View logs with: pm2 logs jumpcsra-server"