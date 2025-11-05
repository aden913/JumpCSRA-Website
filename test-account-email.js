/**
 * Test Account Creation Email
 * Quick test to verify account creation email functionality
 */

// Test data
const testUser = {
  email: 'coxaden@gmail.com', // Your email
  name: 'Test Account User',
  uid: 'test_user_' + Date.now()
};

async function testAccountCreationEmail() {
  console.log('🔬 Testing Account Creation Email...');
  console.log('📧 Sending to:', testUser.email);
  
  try {
    const response = await fetch('http://170.187.145.7:3001/api/email/account-created', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'jumpcsra_secure_api_key_2024'
      },
      body: JSON.stringify({
        customerEmail: testUser.email,
        customerName: testUser.name,
        customerId: testUser.uid
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('✅ Account creation email test result:', result);
    
    if (result.success) {
      console.log('🎉 Email sent successfully! Check your inbox.');
      console.log('📧 Message ID:', result.messageId);
    } else {
      console.log('❌ Email failed to send:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Account creation email test failed:', error);
  }
}

// Run the test
testAccountCreationEmail();