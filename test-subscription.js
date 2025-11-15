const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFunctions } = require('firebase-admin/functions');

// Initialize Firebase Admin SDK
const serviceAccount = {
  // Add your service account key here or use environment variables
  type: "service_account",
  project_id: "pppro-b060e"
};

if (!admin.apps.length) {
  admin.initializeApp({
    // You'll need to set GOOGLE_APPLICATION_CREDENTIALS environment variable
    // or provide service account key
    projectId: 'pppro-b060e'
  });
}

async function testSubscription() {
  try {
    console.log('🔥 Testing PayPal subscription creation...');
    
    // Test data
    const testData = {
      subscriptionType: 'annual',
      customerInfo: {
        name: 'Test User',
        email: 'test@example.com'
      }
    };

    // Make HTTP request to the callable function
    const response = await fetch('https://us-central1-pppro-b060e.cloudfunctions.net/createMembershipSubscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: testData })
    });

    console.log('📊 Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Success! Response:', JSON.stringify(result, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:', errorText);
    }
    
  } catch (error) {
    console.error('💥 Error testing subscription:', error);
  }
}

testSubscription();