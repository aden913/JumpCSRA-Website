#!/bin/bash

# Firebase Storage Migration Setup Script

echo "🔥 Firebase Storage Migration Setup"
echo "=================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "📦 Installing required dependencies..."

# Install firebase-admin
echo "Installing firebase-admin..."
npm install firebase-admin

# Install sharp for image compression
echo "Installing sharp for image compression..."
npm install sharp

echo "✅ Dependencies installed successfully!"
echo ""
echo "📋 Next Steps:"
echo "1. Download your Firebase service account key:"
echo "   - Go to Firebase Console → Project Settings → Service Accounts"
echo "   - Click 'Generate new private key'"
echo "   - Save as 'firebase-service-account-key.json' in this directory"
echo ""
echo "2. Add to .gitignore (if not already present):"
echo "   echo 'firebase-service-account-key.json' >> .gitignore"
echo ""
echo "3. Run the image upload:"
echo "   node upload-images-to-firebase.js"
echo ""
echo "📖 For detailed instructions, see: FIREBASE_STORAGE_MIGRATION.md"