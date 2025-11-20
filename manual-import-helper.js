// Simple manual import - copy this data to Firebase Console
const paypalConfig = {
  "productId": "PROD_JUMP_CLUB_MEMBERSHIP_2024",
  "planId": "P-SANDBOX_JUMP_CLUB_MONTHLY_149", 
  "createdAt": "2024-11-20T00:00:00Z",
  "status": "ACTIVE",
  "planDetails": {
    "name": "Jump Club Monthly Membership",
    "description": "Monthly subscription to Jump Club with premium inflatable delivery and benefits", 
    "amount": "149.00",
    "currency": "USD",
    "interval": "MONTH",
    "intervalCount": 1,
    "totalCycles": 0,
    "environment": "sandbox"
  },
  "paymentPreferences": {
    "autoBillOutstanding": true,
    "setupFee": "0.00", 
    "setupFeeFailureAction": "CONTINUE",
    "paymentFailureThreshold": 3
  },
  "urls": {
    "returnUrl": "http://localhost:3000/subscription-success?success=true",
    "cancelUrl": "http://localhost:3000/subscription-success?cancelled=true"
  }
};

console.log('📋 MANUAL IMPORT INSTRUCTIONS:');
console.log('1. Go to Firebase Console: https://console.firebase.google.com/project/pppro-b060e/firestore');
console.log('2. Click "Start collection" and create collection: paypalConfig');
console.log('3. Add document with ID: membershipPlanMonthly');
console.log('4. Copy the following JSON data:\n');
console.log(JSON.stringify(paypalConfig, null, 2));
console.log('\n✅ This data should be imported into paypalConfig/membershipPlanMonthly');

// Alternative: Simple REST API call
const fs = require('fs');

// Also create a simplified JSON file for easy copy-paste
fs.writeFileSync('paypal-config-for-manual-import.json', JSON.stringify(paypalConfig, null, 2));
console.log('\n📁 Also saved to: paypal-config-for-manual-import.json');
console.log('   You can copy-paste this file content into Firebase Console');