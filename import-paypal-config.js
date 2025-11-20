const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'pppro-b060e',
    credential: admin.credential.applicationDefault(),
    databaseURL: 'https://pppro-b060e-default-rtdb.firebaseio.com'
  });
}

const db = admin.firestore();

async function importPayPalConfig() {
  try {
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync('./paypal-subscription-plan.json', 'utf8'));
    
    // Get the paypalConfig data
    const paypalConfig = jsonData.paypalConfig;
    
    // Import each document in the paypalConfig collection
    for (const [docId, docData] of Object.entries(paypalConfig)) {
      console.log(`📥 Importing document: paypalConfig/${docId}`);
      
      await db.collection('paypalConfig').doc(docId).set(docData);
      console.log(`✅ Successfully imported: paypalConfig/${docId}`);
      console.log(`🆔 Plan ID: ${docData.planId}`);
    }
    
    console.log('🎉 Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Run the import
importPayPalConfig();