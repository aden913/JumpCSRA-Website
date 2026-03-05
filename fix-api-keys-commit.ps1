# Quick Fix Script - Remove API Keys and Amend Commit
# Run this script to sanitize files and amend the last commit

Write-Host "🔒 Removing API Keys from Repository Files..." -ForegroundColor Cyan
Write-Host ""

# Navigate to the repository root
$repoRoot = $PSScriptRoot
Set-Location $repoRoot

Write-Host "📁 Current directory: $repoRoot" -ForegroundColor Yellow
Write-Host ""

# Stage the sanitized files
Write-Host "📝 Staging sanitized files..." -ForegroundColor Green
git add JumpCSRA/vite.config.ts
git add build-production.sh
git add build-production.ps1
git add PRODUCTION_ENV_FIX.md

# Also add the new documentation files
git add DEV_ENVIRONMENT_FIX.md
git add GIT_COMMIT_AMEND_GUIDE.md

# Show what's staged
Write-Host ""
Write-Host "📋 Files staged for commit:" -ForegroundColor Yellow
git diff --cached --name-only

Write-Host ""
Write-Host "⚠️  About to amend the last commit 'logging' to remove API keys" -ForegroundColor Yellow
Write-Host ""
Write-Host "Last commit: " -NoNewline
git log -1 --oneline

Write-Host ""
$response = Read-Host "Do you want to amend this commit? (yes/no)"

if ($response -eq "yes" -or $response -eq "y") {
    Write-Host ""
    Write-Host "🔄 Amending commit..." -ForegroundColor Green
    git commit --amend -m "Add improved logging for API keys (sanitized)"
    
    Write-Host ""
    Write-Host "✅ Commit amended successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 New commit:" -ForegroundColor Yellow
    git log -1 --oneline
    
    Write-Host ""
    Write-Host "⚠️  NEXT STEPS:" -ForegroundColor Yellow
    Write-Host "1. If you already pushed the old commit, you need to force push:" -ForegroundColor White
    Write-Host "   git push --force origin main" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Rotate your API keys since they were in git history:" -ForegroundColor White
    Write-Host "   - Firebase API Key" -ForegroundColor White
    Write-Host "   - Google Maps API Key" -ForegroundColor White
    Write-Host "   - Email Service API Key" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Create a .env.production file on your server with real keys" -ForegroundColor White
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "❌ Commit amend cancelled." -ForegroundColor Red
    Write-Host ""
    Write-Host "You can manually amend with:" -ForegroundColor Yellow
    Write-Host "  git commit --amend -m 'Add improved logging for API keys (sanitized)'" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
