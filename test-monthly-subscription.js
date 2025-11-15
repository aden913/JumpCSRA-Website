const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDI7UzZUV_iJXsGI4KMXyTq5YkfGQZOWwQ",
  authDomain: "pppro-b060e.firebaseapp.com",
  projectId: "pppro-b060e",
  storageBucket: "pppro-b060e.firebasestorage.app",
  messagingSenderId: "661156763953",
  appId: "1:661156763953:web:5fd1b12b9b8b9b3f9e0c42"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

async function testSubscriptionFlow() {
  try {
    console.log('🎪 Testing Complete Monthly Subscription Flow...');
    console.log('================================================');
    
    // Test data for subscription creation
    const subscriptionData = {
      userId: 'test-user-123',
      planAmount: 149,
      currency: 'USD',
      userEmail: 'test@example.com',
      userName: 'Test User'
    };

    console.log('📋 Creating subscription with data:');
    console.log(JSON.stringify(subscriptionData, null, 2));
    console.log('');

    // Create subscription
    const createSubscription = httpsCallable(functions, 'createMembershipSubscription');
    const result = await createSubscription(subscriptionData);
    
    console.log('✅ Subscription Creation Result:');
    console.log(JSON.stringify(result.data, null, 2));
    console.log('');
    
    if (result.data.success && result.data.approvalUrl) {
      console.log('🎉 SUCCESS! Monthly subscription flow working!');
      console.log('💰 Plan Amount: $149/month');
      console.log('🔗 PayPal Approval URL:', result.data.approvalUrl);
      console.log('📋 Subscription ID:', result.data.subscriptionId);
      console.log('');
      console.log('ℹ️  In a real flow, the user would be redirected to:');
      console.log(result.data.approvalUrl);
    } else {
      console.log('❌ Subscription creation failed');
    }
    
  } catch (error) {
    console.error('💥 Error testing subscription flow:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
    if (error.details) {
      console.error('Error details:', error.details);
    }
  }
}

testSubscriptionFlow();