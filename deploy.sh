#!/bin/bash

# JumpCSRA Deployment Script for Linode
echo "🚀 Starting JumpCSRA deployment..."

# Set deployment directory
DEPLOY_DIR="/var/www/jumpcsra"

# Create directory if it doesn't exist
sudo mkdir -p $DEPLOY_DIR

# Copy project files
echo "📁 Copying project files..."
sudo cp -r . $DEPLOY_DIR/

# Set permissions
sudo chown -R $USER:$USER $DEPLOY_DIR

# Install serverFiles dependencies
echo "📦 Installing backend dependencies..."
cd $DEPLOY_DIR/serverFiles
npm install --production

# Build React app if not already built
echo "🔨 Building React application..."
cd $DEPLOY_DIR/JumpCSRA
npm install
npm run build

# Copy environment template
echo "⚙️ Setting up environment..."
cd $DEPLOY_DIR/serverFiles
if [ ! -f .env ]; then
    echo "Creating .env file template..."
    cat > .env << EOL
NODE_ENV=production
PORT=3000
SENDGRID_API_KEY=your_sendgrid_api_key_here
FIREBASE_PROJECT_ID=your_firebase_project_id
FRONTEND_URL=https://your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOL
    echo "⚠️  Please edit .env file with your actual credentials"
fi

# Start with PM2
echo "🔄 Starting server with PM2..."
cd $DEPLOY_DIR
pm2 delete jumpcsra-server 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "✅ Deployment complete!"
echo "🌐 Server should be running on port 3000"
echo "📝 Don't forget to:"
echo "   1. Edit /var/www/jumpcsra/serverFiles/.env with your credentials"
echo "   2. Set up Nginx reverse proxy if needed"
echo "   3. Configure SSL certificate"