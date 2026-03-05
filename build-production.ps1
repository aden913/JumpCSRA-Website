# Production Build Script for Windows
# This script ensures environment variables are available during the Vite build process

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting production build with environment variables..." -ForegroundColor Green
Write-Host ""

# Set all required environment variables for the build
# TODO: Replace these with your actual values or load from a secure .env file
$env:VITE_FIREBASE_API_KEY = "your_firebase_api_key_here"
$env:VITE_FIREBASE_AUTH_DOMAIN = "your_firebase_auth_domain_here"
$env:VITE_FIREBASE_DATABASE_URL = "your_firebase_database_url_here"
$env:VITE_FIREBASE_PROJECT_ID = "your_firebase_project_id_here"
$env:VITE_FIREBASE_STORAGE_BUCKET = "your_firebase_storage_bucket_here"
$env:VITE_FIREBASE_MESSAGING_SENDER_ID = "your_firebase_messaging_sender_id_here"
$env:VITE_FIREBASE_APP_ID = "your_firebase_app_id_here"
$env:VITE_GOOGLE_MAPS_API_KEY = "your_google_maps_api_key_here"
$env:VITE_EMAIL_SERVICE_URL = "http://your_email_service_url_here"
$env:VITE_EMAIL_API_KEY = "your_email_api_key_here"

# Or load from a secure .env file:
# Get-Content ".env.production.local" | ForEach-Object {
#     if ($_ -match '^([^=]+)=(.*)$') {
#         Set-Item -Path "env:$($matches[1])" -Value $matches[2]
#     }
# }

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
