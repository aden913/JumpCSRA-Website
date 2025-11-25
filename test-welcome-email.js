// Test the new welcome email function
const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

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

async function testWelcomeEmail() {
  try {
    console.log('🧪 Testing subscription welcome email...');
    
    // We need to call activateSubscription to trigger the welcome email
    const activateSubscription = httpsCallable(functions, 'activateSubscription');
    
    // This will fail because we need auth, but the idea is to trigger a fresh subscription activation
    console.log('Note: For full test, sign up for a new membership to trigger welcome email');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWelcomeEmail();