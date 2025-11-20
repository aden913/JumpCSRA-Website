const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Initialize the app with minimal config
const app = initializeApp({
  projectId: 'pppro-b060e'
});
const db = getFirestore(app);

async function importConfig() {
  try {
    console.log('📋 Reading PayPal configuration...');
    const configData = JSON.parse(fs.readFileSync('./paypal-subscription-plan.json', 'utf8'));
    
    console.log('📤 Importing to Firestore...');
    await db.collection('paypalConfig').doc('membershipPlanMonthly')
      .set(configData.paypalConfig.membershipPlanMonthly);
    
    console.log('✅ Successfully imported PayPal configuration!');
    console.log('Plan ID:', configData.paypalConfig.membershipPlanMonthly.planId);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

importConfig();