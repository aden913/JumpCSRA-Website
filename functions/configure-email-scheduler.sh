#!/bin/bash

# Email Scheduler Configuration Script for Firebase Functions

echo "📧 JumpCSRA Email Scheduler Configuration"
echo "========================================"

echo ""
echo "Current Configuration:"
firebase functions:config:get

echo ""
echo "Choose an option:"
echo "1) Enable Testing Mode (emails fire every few minutes)"
echo "2) Disable Testing Mode (normal production timing)"
echo "3) View current configuration only"
echo "4) Deploy functions with current config"

read -p "Enter choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "🧪 Enabling Testing Mode..."
    firebase functions:config:set email.testing_mode="true"
    echo ""
    echo "✅ Testing mode enabled! Email timing:"
    echo "   • Cart Abandonment: 1 minute (was 24 hours)"
    echo "   • Deposit Reminder: 2 minutes (was 7 days)" 
    echo "   • Event Confirmation: 3 minutes (was 3 days)"
    echo "   • Post-Event Thanks: 4 minutes (was 1 day)"
    echo "   • Rebooking Reminder: 5 minutes (was 9 months)"
    echo "   • Scheduler runs every 2 minutes (was 6 hours)"
    echo ""
    read -p "Deploy functions now? (y/n): " deploy
    if [[ $deploy == "y" || $deploy == "Y" ]]; then
      echo "🚀 Deploying functions..."
      firebase deploy --only functions
    else
      echo "⚠️  Remember to deploy with: firebase deploy --only functions"
    fi
    ;;
  2)
    echo ""
    echo "🏭 Disabling Testing Mode (Production Mode)..."
    firebase functions:config:unset email.testing_mode
    echo ""
    echo "✅ Production mode enabled! Email timing:"
    echo "   • Cart Abandonment: 24 hours"
    echo "   • Deposit Reminder: 7 days"
    echo "   • Event Confirmation: 3 days" 
    echo "   • Post-Event Thanks: 1 day"
    echo "   • Rebooking Reminder: 9 months"
    echo "   • Scheduler runs every 6 hours"
    echo ""
    read -p "Deploy functions now? (y/n): " deploy
    if [[ $deploy == "y" || $deploy == "Y" ]]; then
      echo "🚀 Deploying functions..."
      firebase deploy --only functions
    else
      echo "⚠️  Remember to deploy with: firebase deploy --only functions"
    fi
    ;;
  3)
    echo ""
    echo "📋 Current Configuration:"
    firebase functions:config:get
    ;;
  4)
    echo ""
    echo "🚀 Deploying functions with current configuration..."
    firebase deploy --only functions
    ;;
  *)
    echo "❌ Invalid choice. Please run the script again."
    exit 1
    ;;
esac

echo ""
echo "📊 To monitor email scheduler:"
echo "   firebase functions:log --only processScheduledEmails"
echo ""
echo "🧪 To test manually:"
echo "   firebase functions:shell"
echo "   > processScheduledEmails()"
echo ""
echo "📧 Done!"