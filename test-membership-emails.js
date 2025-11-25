// Test script for membership emails
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

async function testMembershipConfirmationEmail() {
  try {
    console.log('🧪 Testing membership confirmation email...');
    
    const testConfirmationEmail = httpsCallable(functions, 'testMembershipConfirmationEmail');
    
    const result = await testConfirmationEmail({
      email: 'coxaden@gmail.com'  // Use your actual email
    });
    
    console.log('✅ Test email result:', result.data);
  } catch (error) {
    console.error('❌ Error testing email:', error);
  }
}

// Run the test
testMembershipConfirmationEmail();