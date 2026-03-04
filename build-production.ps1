# Production Build Script for Windows
# This script ensures environment variables are available during the Vite build process

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting production build with environment variables..." -ForegroundColor Green
Write-Host ""

# Set all required environment variables for the build
$env:VITE_FIREBASE_API_KEY = "AIzaSyDs39ycP3-tg21iBpWul8cp6hoqoKhI2cE"
$env:VITE_FIREBASE_AUTH_DOMAIN = "pppro-b060e.firebaseapp.com"
$env:VITE_FIREBASE_DATABASE_URL = "https://pppro-b060e-default-rtdb.firebaseio.com"
$env:VITE_FIREBASE_PROJECT_ID = "pppro-b060e"
$env:VITE_FIREBASE_STORAGE_BUCKET = "pppro-b060e.firebasestorage.app"
$env:VITE_FIREBASE_MESSAGING_SENDER_ID = "819237875595"
$env:VITE_FIREBASE_APP_ID = "1:819237875595:web:1ee4ce4c815c1b4d2f498e"
$env:VITE_GOOGLE_MAPS_API_KEY = "AIzaSyC2sy437445zrOR1YMXuMjiSrH3ZY8D0uo"
$env:VITE_EMAIL_SERVICE_URL = "http://173.230.132.127:3001"
$env:VITE_EMAIL_API_KEY = "your_email_api_key_here"

Write-Host "✅ Environment variables set" -ForegroundColor Green
Write-Host ""

# Navigate to the JumpCSRA directory
Set-Location "$PSScriptRoot\JumpCSRA"

Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "🏗️  Building application..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "✅ Build complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Build output:"
Get-ChildItem -Path "build" -Recurse | Select-Object Name, Length, LastWriteTime | Format-Table

Write-Host ""
Write-Host "✅ Local build successful!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 To deploy to production server, upload the build folder and restart PM2"
