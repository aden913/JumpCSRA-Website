#!/bin/bash

echo "🔧 Quick Fix Script for JumpCSRA Server"

# Set the deployment directory
DEPLOY_DIR="/var/www/jumpcsra"

# Stop PM2 process
echo "🛑 Stopping PM2..."
pm2 stop jumpcsra-server 2>/dev/null || true

# Pull latest changes
echo "📥 Pulling latest changes..."
cd $DEPLOY_DIR
git pull origin main

# Ensure React build exists
echo "🔨 Building React app..."
cd $DEPLOY_DIR/JumpCSRA
npm install --no-workspaces
npm run build

# Check if build directory exists and has content
if [ ! -d "$DEPLOY_DIR/JumpCSRA/build/client" ]; then
    echo "❌ React build failed - creating temporary index.html"
    mkdir -p $DEPLOY_DIR/JumpCSRA/build/client
    cat > $DEPLOY_DIR/JumpCSRA/build/client/index.html << 'EOL'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JumpCSRA - Coming Soon</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            margin: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }
        h1 { font-size: 3em; margin-bottom: 20px; }
        p { font-size: 1.2em; margin-bottom: 30px; }
        .api-status { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px auto; max-width: 600px; }
    </style>
</head>
<body>
    <h1>🎉 JumpCSRA</h1>
    <p>Your bounce house rental service is coming soon!</p>
    <div class="api-status">
        <h3>🔧 Server Status</h3>
        <p>Email API: <span id="email-status">Testing...</span></p>
        <p>Database: <span id="db-status">Testing...</span></p>
    </div>
    <script>
        // Test API endpoints
        fetch('/api/email/health')
            .then(response => response.json())
            .then(data => {
                document.getElementById('email-status').textContent = data.status === 'healthy' ? '✅ Online' : '❌ Offline';
            })
            .catch(() => {
                document.getElementById('email-status').textContent = '❌ Offline';
            });
        
        fetch('/health')
            .then(response => response.json())
            .then(data => {
                document.getElementById('db-status').textContent = data.status === 'healthy' ? '✅ Online' : '❌ Offline';
            })
            .catch(() => {
                document.getElementById('db-status').textContent = '❌ Offline';
            });
    </script>
</body>
</html>
EOL
    echo "✅ Created temporary index.html"
fi

# Install server dependencies
echo "📦 Installing server dependencies..."
cd $DEPLOY_DIR/serverFiles
npm install --production --no-workspaces

# Set proper permissions
echo "🔐 Setting permissions..."
sudo chown -R aden:aden $DEPLOY_DIR
chmod -R 755 $DEPLOY_DIR

# Start PM2
echo "🚀 Starting server..."
cd $DEPLOY_DIR
pm2 start ecosystem.config.js

echo "✅ Quick fix complete!"
echo "🌐 Check your site at: http://170.187.145.7:3000"
echo "📊 Check status: pm2 list"
echo "📄 Check logs: pm2 logs jumpcsra-server"