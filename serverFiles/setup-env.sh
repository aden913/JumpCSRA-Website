#!/bin/bash

echo "🔧 JumpCSRA Environment Setup"

# Check if we're in the serverFiles directory
if [ ! -f "env.template" ]; then
    echo "❌ Run this script from the serverFiles directory"
    echo "Usage: cd /var/www/jumpcsra/serverFiles && bash setup-env.sh"
    exit 1
fi

# Create .env from template if it doesn't exist
if [ ! -f .env ]; then
    echo "📋 Creating .env from template..."
    cp env.template .env
    echo "✅ Created .env file"
else
    echo "⚠️  .env file already exists"
fi

echo ""
echo "🔑 IMPORTANT: You must add your actual credentials to .env"
echo ""
echo "Edit the file:"
echo "  nano .env"
echo ""
echo "Required credentials:"
echo "  1. SENDGRID_API_KEY=SG.your_actual_sendgrid_key"
echo "  2. FIREBASE_PROJECT_ID=jumpcsra-f3e84"  
echo "  3. FIREBASE_CLIENT_EMAIL=firebase-adminsdk-4p51k@jumpcsra-f3e84.iam.gserviceaccount.com"
echo "  4. FIREBASE_PRIVATE_KEY=\"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n\""
echo ""
echo "📖 Get credentials from:"
echo "  • SendGrid: https://app.sendgrid.com/settings/api_keys"
echo "  • Firebase: Console > Project Settings > Service Accounts"
echo ""
echo "After editing .env, restart the server:"
echo "  pm2 restart jumpcsra-server"