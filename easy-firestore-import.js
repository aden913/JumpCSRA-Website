const fs = require('fs');
const { execSync } = require('child_process');

// Read the config
const config = JSON.parse(fs.readFileSync('paypal-subscription-plan.json', 'utf8'));
const membershipPlan = config.paypalConfig.membershipPlanMonthly;

// Create a temporary file for Firebase CLI
const tempFile = 'temp-firestore-data.json';
fs.writeFileSync(tempFile, JSON.stringify(membershipPlan, null, 2));

console.log('📋 Created temporary data file');
console.log('🔄 Attempting to import to Firestore...');

try {
  // Try using firebase database:import (works for some project configurations)
  execSync(`firebase firestore:delete paypalConfig/membershipPlanMonthly --force`, { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  Document may not exist yet (this is ok)');
}

console.log('\n📝 MANUAL STEPS REQUIRED:');
console.log('1. Copy the following command:');
console.log('   firebase firestore:set paypalConfig/membershipPlanMonthly temp-firestore-data.json');
console.log('2. Run it in your terminal');
console.log('\nOr copy this data and paste it manually in Firebase Console:');
console.log(JSON.stringify(membershipPlan, null, 2));

// Clean up
try {
  fs.unlinkSync(tempFile);
} catch (error) {
  // Ignore cleanup errors
}