#!/bin/bash
# Production Build Script
# This script ensures environment variables are available during the Vite build process

set -e  # Exit on error

echo "🚀 Starting production build with environment variables..."
echo ""

# Set all required environment variables for the build
# TODO: Replace these with your actual values or source from a secure .env file
export VITE_FIREBASE_API_KEY="your_firebase_api_key_here"
export VITE_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain_here"
export VITE_FIREBASE_DATABASE_URL="your_firebase_database_url_here"
export VITE_FIREBASE_PROJECT_ID="your_firebase_project_id_here"
export VITE_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket_here"
export VITE_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id_here"
export VITE_FIREBASE_APP_ID="your_firebase_app_id_here"
export VITE_GOOGLE_MAPS_API_KEY="your_google_maps_api_key_here"
export VITE_EMAIL_SERVICE_URL="http://your_email_service_url_here"
export VITE_EMAIL_API_KEY="your_email_api_key_here"

# Or source from a secure .env file:
# if [ -f ".env.production.local" ]; then
#   export $(cat .env.production.local | grep -v '^#' | xargs)
# fi

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
