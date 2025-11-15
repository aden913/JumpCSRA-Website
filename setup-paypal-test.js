const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable, connectFunctionsEmulator } = require('firebase/functions');

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

async function runSetupPayPalPlans() {
  try {
    console.log('🔥 Calling setupPayPalPlansStandalone...');
    
    const setupFunction = httpsCallable(functions, 'setupPayPalPlansStandalone');
    const result = await setupFunction({});
    
    console.log('✅ Setup completed successfully!');
    console.log('Result:', JSON.stringify(result.data, null, 2));
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
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

runSetupPayPalPlans();