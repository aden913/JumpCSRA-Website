# PowerShell script to deploy JumpCSRA to Linode server
Write-Host "🚀 Deploying JumpCSRA to Linode server..." -ForegroundColor Green

$SERVER = "170.187.145.7"
$SERVER_PATH = "/var/www/jumpcsra"

# 1. Copy .env file with credentials
Write-Host "📁 Copying environment file..." -ForegroundColor Yellow
scp "C:\Users\Aden\Documents\GitHub\JumpCSRA-Website\serverFiles\.env" "root@${SERVER}:${SERVER_PATH}/serverFiles/"

# 2. Copy updated server.js
Write-Host "🔧 Copying updated server files..." -ForegroundColor Yellow
scp "C:\Users\Aden\Documents\GitHub\JumpCSRA-Website\serverFiles\server.js" "root@${SERVER}:${SERVER_PATH}/serverFiles/"
scp "C:\Users\Aden\Documents\GitHub\JumpCSRA-Website\serverFiles\package.json" "root@${SERVER}:${SERVER_PATH}/serverFiles/"

# 3. Copy React build files
Write-Host "⚛️ Copying React build files..." -ForegroundColor Yellow
scp -r "C:\Users\Aden\Documents\GitHub\JumpCSRA-Website\JumpCSRA\build\*" "root@${SERVER}:${SERVER_PATH}/JumpCSRA/build/"

# 4. SSH into server and update
Write-Host "🔄 Updating server dependencies and restarting..." -ForegroundColor Yellow
$sshCommand = "cd ${SERVER_PATH}/serverFiles && npm install && pm2 restart jumpcsra-server || pm2 start server.js --name jumpcsra-server && pm2 save"
ssh root@${SERVER} $sshCommand

Write-Host "✅ Deployment completed!" -ForegroundColor Green
Write-Host "🌐 Your website should now be available at: https://jumpcsra.com" -ForegroundColor Cyan
Write-Host "📊 Check server status with command: ssh root@${SERVER} pm2 status" -ForegroundColor Gray