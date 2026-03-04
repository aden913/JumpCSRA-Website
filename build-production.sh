#!/bin/bash
# Production Build Script
# This script ensures environment variables are available during the Vite build process

set -e  # Exit on error

echo "🚀 Starting production build with environment variables..."
echo ""

# Set all required environment variables for the build
export VITE_FIREBASE_API_KEY=AIzaSyDs39ycP3-tg21iBpWul8cp6hoqoKhI2cE
export VITE_FIREBASE_AUTH_DOMAIN=pppro-b060e.firebaseapp.com
export VITE_FIREBASE_DATABASE_URL=https://pppro-b060e-default-rtdb.firebaseio.com
export VITE_FIREBASE_PROJECT_ID=pppro-b060e
export VITE_FIREBASE_STORAGE_BUCKET=pppro-b060e.firebasestorage.app
export VITE_FIREBASE_MESSAGING_SENDER_ID=819237875595
export VITE_FIREBASE_APP_ID=1:819237875595:web:1ee4ce4c815c1b4d2f498e
export VITE_GOOGLE_MAPS_API_KEY=AIzaSyC2sy437445zrOR1YMXuMjiSrH3ZY8D0uo
export VITE_EMAIL_SERVICE_URL=http://173.230.132.127:3001
export VITE_EMAIL_API_KEY=your_email_api_key_here

echo "✅ Environment variables exported"
echo ""

# Navigate to the JumpCSRA directory
cd "$(dirname "$0")/JumpCSRA"

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🏗️  Building application..."
npm run build

echo ""
echo "✅ Build complete!"
echo ""
echo "📊 Build output:"
ls -lh build/

echo ""
echo "🔄 Restarting PM2 service..."
pm2 restart ssr-server

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Check logs with: pm2 logs ssr-server"
echo "📊 Check status with: pm2 status"
