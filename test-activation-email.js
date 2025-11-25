// Test script for activation email
const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInAnonymously } = require('firebase/auth');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC-CXNNgP6Z2vQlPU5mDKiS8z-gfg7nJss",
  authDomain: "pppro-b060e.firebaseapp.com",
  databaseURL: "https://pppro-b060e-default-rtdb.firebaseio.com",
  projectId: "pppro-b060e",
  storageBucket: "pppro-b060e.firebasestorage.app",
  messagingSenderId: "563584335869",
  appId: "1:563584335869:web:10b9f45b99d2fab3df14b5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

async function testActivationEmail() {
  try {
    console.log('🧪 Testing subscription activation email...');
    
    // Sign in anonymously to get auth context
    await signInAnonymously(auth);
    console.log('✅ Signed in anonymously');
    
    const activateSubscription = httpsCallable(functions, 'activateSubscription');
    
    // Use a real subscription ID from the logs (I-0S4FFNEHF1KM)
    const result = await activateSubscription({
      subscriptionId: 'I-0S4FFNEHF1KM',
      baToken: 'BA-test-token'
    });
    
    console.log('✅ Activation result:', result.data);
  } catch (error) {
    console.error('❌ Error testing activation:', error);
  }
}

// Run the test
testActivationEmail();