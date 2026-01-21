#!/bin/bash

# Deployment script for JumpCSRA SSR Server
# Run this on your production server: bash deploy-ssr.sh

set -e  # Exit on any error

echo "🚀 Starting SSR Server Deployment..."

SSR_DIR="/var/www/jumpcsra-ssr"
SOURCE_DIR="/var/www/jumpcsra/JumpCSRA"

echo ""
echo "📦 Step 1: Building application from source..."
cd "$SOURCE_DIR"
npm run build

echo ""
echo "📋 Step 2: Copying build files to SSR directory..."
rm -rf "$SSR_DIR/build"
cp -r build "$SSR_DIR/"

echo ""
echo "📝 Step 3: Checking server.ts exists..."
if [ ! -f "$SSR_DIR/server.ts" ]; then
    echo "❌ ERROR: server.ts not found in $SSR_DIR"
    echo "   Please copy server.ts to $SSR_DIR first!"
    exit 1
fi

echo ""
echo "📦 Step 4: Installing dependencies..."
cd "$SSR_DIR"
npm install

echo ""
echo "🔄 Step 5: Restarting PM2 process..."
pm2 stop ssr-server || true
pm2 delete ssr-server || true
pm2 start server.ts --name ssr-server --node-args="--loader tsx" --env production
pm2 save

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Check status with: pm2 status"
echo "📋 View logs with: pm2 logs ssr-server"
echo "🔍 Monitor with: pm2 monit"
