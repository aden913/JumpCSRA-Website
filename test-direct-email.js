// Quick test for SendGrid email delivery
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

async function testDirectEmail() {
  try {
    console.log('🧪 Testing direct email sending...');
    
    const triggerTestEmail = httpsCallable(functions, 'triggerTestEmail');
    
    const result = await triggerTestEmail({
      testEmail: 'coxaden@gmail.com',
      subject: 'Direct SendGrid Test',
      message: 'This is a direct test to see if SendGrid emails are reaching you.'
    });
    
    console.log('✅ Test email result:', result.data);
  } catch (error) {
    console.error('❌ Error sending test email:', error);
  }
}

// Run the test
testDirectEmail();