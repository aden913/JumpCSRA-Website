/**
 * Quick Email Endpoint Test
 * Tests all endpoints with simple data to verify they're working
 */

const TEST_SERVER = 'http://170.187.145.7:3001';
const TEST_EMAIL = 'coxaden@gmail.com';

// Simple test data
const testData = {
  customerName: 'Test User',
  customerEmail: TEST_EMAIL,
  customerId: 'test_001'
};

async function quickTest(endpoint, data = testData) {
  try {
    console.log(`\n🧪 Testing: POST /api/email/${endpoint}`);
    
    const response = await fetch(`${TEST_SERVER}/api/email/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ SUCCESS: ${result.message}`);
      console.log(`📧 Email ID: ${result.emailId || 'N/A'}`);
    } else {
      console.log(`❌ ERROR: ${result.error || result.message}`);
    }
    
    return response.ok;
  } catch (error) {
    console.log(`💥 NETWORK ERROR: ${error.message}`);
    return false;
  }
}

async function runQuickTests() {
  console.log('🚀 Quick Email Endpoint Tests');
  console.log(`📡 Server: ${TEST_SERVER}`);
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log('=' .repeat(50));
  
  // Test health first
  try {
    const healthResponse = await fetch(`${TEST_SERVER}/health`);
    const health = await healthResponse.json();
    console.log(`✅ Server Health: ${health.status}`);
  } catch (error) {
    console.log(`❌ Server Health: ${error.message}`);
    return;
  }
  
  // Test all email endpoints
  const endpoints = [
    'test',
    'account-created',
    'cart-reminder',
    'payment-confirmation', 
    'deposit-reminder',
    'booking-confirmation',
    'post-event-thanks',
    'follow-up'
  ];
  
  let passed = 0;
  
  for (const endpoint of endpoints) {
    let testDataForEndpoint = { ...testData };
    
    // Add specific data for each endpoint
    switch (endpoint) {
      case 'cart-reminder':
        testDataForEndpoint.cartItems = [{ name: 'Test Item', price: 100 }];
        testDataForEndpoint.cartTotal = 100;
        break;
      case 'payment-confirmation':
        testDataForEndpoint.bookingId = 'test_booking';
        testDataForEndpoint.paymentAmount = 50;
        break;
      case 'deposit-reminder':
        testDataForEndpoint.bookingId = 'test_booking';
        testDataForEndpoint.remainingAmount = 50;
        break;
      case 'booking-confirmation':
        testDataForEndpoint.bookingId = 'test_booking';
        testDataForEndpoint.eventDate = new Date().toISOString();
        break;
      case 'post-event-thanks':
        testDataForEndpoint.bookingId = 'test_booking';
        break;
      case 'follow-up':
        testDataForEndpoint.lastBookingDate = new Date().toISOString();
        break;
    }
    
    const success = await quickTest(endpoint, testDataForEndpoint);
    if (success) passed++;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`🎯 Results: ${passed}/${endpoints.length} endpoints working`);
  
  if (passed === endpoints.length) {
    console.log('🎉 All endpoints are working! Email server is ready for testing.');
  } else {
    console.log('⚠️  Some endpoints failed. Check server logs and configuration.');
  }
}

// Auto-run
if (typeof window === 'undefined') {
  runQuickTests().catch(console.error);
}

module.exports = { runQuickTests, quickTest };