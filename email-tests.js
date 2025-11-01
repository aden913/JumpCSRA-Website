/**
 * Email Testing Suite for JumpCSRA Email Automation
 * 
 * This file contains comprehensive tests for all email scenarios:
 * - Account creation
 * - Shopping cart reminder  
 * - Payment confirmation
 * - Deposit reminder
 * - Booking confirmation (2 days prior)
 * - Post-event thanks
 * - 9-month follow-up
 */

// Test configuration
const TEST_CONFIG = {
  // Use your production server for testing
  baseUrl: 'http://170.187.145.7:3001',
  // Test email addresses (use your own emails for testing)
  testEmails: {
    primary: 'coxaden@gmail.com',      // Your actual email
    secondary: 'coxaden@gmail.com'     // Your actual email
  },
  // Test customer data
  testCustomer: {
    id: 'test_customer_001',
    name: 'John Test User',
    email: 'coxaden@gmail.com',        // Your actual email
    phone: '555-0123'
  },
  // Test booking data
  testBooking: {
    id: 'test_booking_001',
    eventDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
    items: [
      { name: 'Bounce House', price: 150 },
      { name: 'Water Slide', price: 200 }
    ],
    total: 350,
    deposit: 175,
    remaining: 175
  }
};

// Helper function to make API calls
async function testEmailEndpoint(endpoint, data) {
  try {
    console.log(`\n🧪 Testing: ${endpoint}`);
    console.log('📤 Sending data:', JSON.stringify(data, null, 2));
    
    const response = await fetch(`${TEST_CONFIG.baseUrl}/api/email/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Success:', result.message);
      console.log('📧 Email ID:', result.emailId || 'N/A');
    } else {
      console.log('❌ Error:', result.error || result.message);
    }
    
    return { success: response.ok, data: result };
  } catch (error) {
    console.log('💥 Network Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test 1: Account Creation Email
async function testAccountCreation() {
  console.log('\n🔹 TEST 1: Account Creation Email');
  
  return await testEmailEndpoint('account-created', {
    customerName: TEST_CONFIG.testCustomer.name,
    customerEmail: TEST_CONFIG.testCustomer.email,
    customerId: TEST_CONFIG.testCustomer.id
  });
}

// Test 2: Shopping Cart Reminder
async function testCartReminder() {
  console.log('\n🔹 TEST 2: Shopping Cart Reminder');
  
  return await testEmailEndpoint('cart-reminder', {
    customerName: TEST_CONFIG.testCustomer.name,
    customerEmail: TEST_CONFIG.testCustomer.email,
    cartItems: TEST_CONFIG.testBooking.items,
    cartTotal: TEST_CONFIG.testBooking.total,
    cartId: 'test_cart_001'
  });
}

// Test 3: Payment Confirmation
async function testPaymentConfirmation() {
  console.log('\n🔹 TEST 3: Payment Confirmation');
  
  return await testEmailEndpoint('payment-confirmation', {
    customerName: TEST_CONFIG.testCustomer.name,
    customerEmail: TEST_CONFIG.testCustomer.email,
    bookingId: TEST_CONFIG.testBooking.id,
    paymentAmount: TEST_CONFIG.testBooking.deposit,
    bookingDetails: {
      eventDate: TEST_CONFIG.testBooking.eventDate,
      items: TEST_CONFIG.testBooking.items,
      total: TEST_CONFIG.testBooking.total,
      amountPaid: TEST_CONFIG.testBooking.deposit,
      remainingBalance: TEST_CONFIG.testBooking.remaining
    }
  });
}

// Test 4: Deposit Reminder
async function testDepositReminder() {
  console.log('\n🔹 TEST 4: Deposit Reminder');
  
  return await testEmailEndpoint('deposit-reminder', {
    customerName: TEST_CONFIG.testCustomer.name,
    customerEmail: TEST_CONFIG.testCustomer.email,
    bookingId: TEST_CONFIG.testBooking.id,
    remainingAmount: TEST_CONFIG.testBooking.remaining,
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    bookingDetails: {
      eventDate: TEST_CONFIG.testBooking.eventDate,
      items: TEST_CONFIG.testBooking.items
    }
  });
}

// Test 5: Booking Confirmation (2 days prior)
async function testBookingConfirmation() {
  console.log('\n🔹 TEST 5: Booking Confirmation (2 days prior)');
  
  return await testEmailEndpoint('booking-confirmation', {
    customerName: TEST_CONFIG.testCustomer.name,
    customerEmail: TEST_CONFIG.testCustomer.email,
    bookingId: TEST_CONFIG.testBooking.id,
    eventDate: TEST_CONFIG.testBooking.eventDate,
    bookingDetails: {
      items: TEST_CONFIG.testBooking.items,
      setupTime: '10:00 AM',
      pickupTime: '6:00 PM',
      address: '123 Test Street, Test City, TC 12345'
    }
  });
}

// Test 6: Post-Event Thank You
async function testPostEventThanks() {
  console.log('\n🔹 TEST 6: Post-Event Thank You');
  
  return await testEmailEndpoint('post-event-thanks', {
    customerName: TEST_CONFIG.testCustomer.name,
    customerEmail: TEST_CONFIG.testCustomer.email,
    bookingId: TEST_CONFIG.testBooking.id,
    eventDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    bookingDetails: {
      items: TEST_CONFIG.testBooking.items
    }
  });
}

// Test 7: 9-Month Follow-up
async function testFollowUpEmail() {
  console.log('\n🔹 TEST 7: 9-Month Follow-up Email');
  
  return await testEmailEndpoint('follow-up', {
    customerName: TEST_CONFIG.testCustomer.name,
    customerEmail: TEST_CONFIG.testCustomer.email,
    lastBookingDate: new Date(Date.now() - 270 * 24 * 60 * 60 * 1000).toISOString(), // 9 months ago
    lastBookingId: TEST_CONFIG.testBooking.id
  });
}

// Test Server Health
async function testServerHealth() {
  console.log('\n🔹 SERVER HEALTH CHECK');
  
  try {
    const response = await fetch(`${TEST_CONFIG.baseUrl}/health`);
    const data = await response.json();
    
    console.log('✅ Server Status:', data.status);
    console.log('📊 Version:', data.version);
    console.log('🔗 Endpoints:', JSON.stringify(data.endpoints, null, 2));
    
    return { success: true, data };
  } catch (error) {
    console.log('❌ Health Check Failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting JumpCSRA Email System Tests...');
  console.log('📧 Test emails will be sent to:', TEST_CONFIG.testEmails.primary);
  console.log('🌐 Testing server:', TEST_CONFIG.baseUrl);
  
  const results = {};
  
  // Health check first
  results.health = await testServerHealth();
  
  if (!results.health.success) {
    console.log('\n❌ Server health check failed. Stopping tests.');
    return results;
  }
  
  // Run all email tests
  results.accountCreation = await testAccountCreation();
  results.cartReminder = await testCartReminder();
  results.paymentConfirmation = await testPaymentConfirmation();
  results.depositReminder = await testDepositReminder();
  results.bookingConfirmation = await testBookingConfirmation();
  results.postEventThanks = await testPostEventThanks();
  results.followUp = await testFollowUpEmail();
  
  // Summary
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${test}: ${result.success ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Email system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
  }
  
  return results;
}

// Export for use in Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runAllTests,
    testAccountCreation,
    testCartReminder,
    testPaymentConfirmation,
    testDepositReminder,
    testBookingConfirmation,
    testPostEventThanks,
    testFollowUpEmail,
    testServerHealth,
    TEST_CONFIG
  };
}

// Auto-run if called directly
if (typeof window === 'undefined' && require.main === module) {
  runAllTests().catch(console.error);
}