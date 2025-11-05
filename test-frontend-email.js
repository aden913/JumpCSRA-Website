/**
 * Test Frontend Email Service
 * Test the backend email service from frontend perspective
 */

import { sendAccountCreationEmail } from './JumpCSRA/app/utils/backendEmailService.js';

async function testFrontendEmailService() {
  console.log('🔬 Testing Frontend Email Service...');
  
  const testUser = {
    email: 'coxaden@gmail.com',
    name: 'Frontend Test User',
    uid: 'frontend_test_' + Date.now()
  };

  try {
    console.log('📧 Calling sendAccountCreationEmail...');
    const result = await sendAccountCreationEmail(testUser);
    console.log('✅ Frontend email service result:', result);
    
  } catch (error) {
    console.error('❌ Frontend email service failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
  }
}

// Make it available in browser console
if (typeof window !== 'undefined') {
  window.testFrontendEmailService = testFrontendEmailService;
}

testFrontendEmailService();