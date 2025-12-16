@echo off
REM Firebase Storage Migration Setup Script for Windows

echo 🔥 Firebase Storage Migration Setup
echo ==================================

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

echo 📦 Installing required dependencies...

REM Install firebase-admin
echo Installing firebase-admin...
npm install firebase-admin

REM Install sharp for image compression
echo Installing sharp for image compression...
npm install sharp

echo.
echo ✅ Dependencies installed successfully!
echo.
echo 📋 Next Steps:
echo 1. Download your Firebase service account key:
echo    - Go to Firebase Console → Project Settings → Service Accounts
echo    - Click 'Generate new private key'
echo    - Save as 'firebase-service-account-key.json' in this directory
echo.
echo 2. Add to .gitignore (if not already present):
echo    echo firebase-service-account-key.json >> .gitignore
echo.
echo 3. Run the image upload:
echo    node upload-images-to-firebase.js
echo.
echo 📖 For detailed instructions, see: FIREBASE_STORAGE_MIGRATION.md

pause