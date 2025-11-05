# Email Scheduler Configuration Script for Firebase Functions (PowerShell)

Write-Host "📧 JumpCSRA Email Scheduler Configuration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Current Configuration:" -ForegroundColor Yellow
firebase functions:config:get

Write-Host ""
Write-Host "Choose an option:" -ForegroundColor Green
Write-Host "1) Enable Testing Mode (emails fire every few minutes)" -ForegroundColor White
Write-Host "2) Disable Testing Mode (normal production timing)" -ForegroundColor White
Write-Host "3) View current configuration only" -ForegroundColor White
Write-Host "4) Deploy functions with current config" -ForegroundColor White

$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🧪 Enabling Testing Mode..." -ForegroundColor Yellow
        firebase functions:config:set email.testing_mode="true"
        Write-Host ""
        Write-Host "✅ Testing mode enabled! Email timing:" -ForegroundColor Green
        Write-Host "   • Cart Abandonment: 1 minute (was 24 hours)" -ForegroundColor White
        Write-Host "   • Deposit Reminder: 2 minutes (was 7 days)" -ForegroundColor White
        Write-Host "   • Event Confirmation: 3 minutes (was 3 days)" -ForegroundColor White
        Write-Host "   • Post-Event Thanks: 4 minutes (was 1 day)" -ForegroundColor White
        Write-Host "   • Rebooking Reminder: 5 minutes (was 9 months)" -ForegroundColor White
        Write-Host "   • Scheduler runs every 2 minutes (was 6 hours)" -ForegroundColor White
        Write-Host ""
        $deploy = Read-Host "Deploy functions now? (y/n)"
        if ($deploy -eq "y" -or $deploy -eq "Y") {
            Write-Host "🚀 Deploying functions..." -ForegroundColor Blue
            firebase deploy --only functions
        } else {
            Write-Host "⚠️  Remember to deploy with: firebase deploy --only functions" -ForegroundColor Yellow
        }
    }
    "2" {
        Write-Host ""
        Write-Host "🏭 Disabling Testing Mode (Production Mode)..." -ForegroundColor Yellow
        firebase functions:config:unset email.testing_mode
        Write-Host ""
        Write-Host "✅ Production mode enabled! Email timing:" -ForegroundColor Green
        Write-Host "   • Cart Abandonment: 24 hours" -ForegroundColor White
        Write-Host "   • Deposit Reminder: 7 days" -ForegroundColor White
        Write-Host "   • Event Confirmation: 3 days" -ForegroundColor White
        Write-Host "   • Post-Event Thanks: 1 day" -ForegroundColor White
        Write-Host "   • Rebooking Reminder: 9 months" -ForegroundColor White
        Write-Host "   • Scheduler runs every 6 hours" -ForegroundColor White
        Write-Host ""
        $deploy = Read-Host "Deploy functions now? (y/n)"
        if ($deploy -eq "y" -or $deploy -eq "Y") {
            Write-Host "🚀 Deploying functions..." -ForegroundColor Blue
            firebase deploy --only functions
        } else {
            Write-Host "⚠️  Remember to deploy with: firebase deploy --only functions" -ForegroundColor Yellow
        }
    }
    "3" {
        Write-Host ""
        Write-Host "📋 Current Configuration:" -ForegroundColor Yellow
        firebase functions:config:get
    }
    "4" {
        Write-Host ""
        Write-Host "🚀 Deploying functions with current configuration..." -ForegroundColor Blue
        firebase deploy --only functions
    }
    default {
        Write-Host "❌ Invalid choice. Please run the script again." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "📊 To monitor email scheduler:" -ForegroundColor Cyan
Write-Host "   firebase functions:log --only processScheduledEmails" -ForegroundColor White
Write-Host ""
Write-Host "🧪 To test manually:" -ForegroundColor Cyan
Write-Host "   firebase functions:shell" -ForegroundColor White
Write-Host "   > processScheduledEmails" -ForegroundColor White
Write-Host ""
Write-Host "📧 Done!" -ForegroundColor Green