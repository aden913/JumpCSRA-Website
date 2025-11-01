/**
 * Email Server Route Discovery Tool
 * This script tests various possible endpoint names to find what's actually available
 */

const TEST_CONFIG = {
  baseUrl: 'http://170.187.145.7:3001',
  testEmail: 'coxaden@gmail.com'
};

// Common endpoint variations to test
const POSSIBLE_ROUTES = [
  // Health/Info endpoints
  '/health',
  '/api/health',
  '/',
  '/status',
  
  // Email endpoints - different naming conventions
  '/api/email/account-created',
  '/api/email/account_created',
  '/api/email/account-creation',
  '/email/account-created',
  '/send-email/account-created',
  
  '/api/email/cart-reminder',
  '/api/email/cart_reminder',
  '/api/email/abandoned-cart',
  '/email/cart-reminder',
  
  '/api/email/payment-confirmation',
  '/api/email/payment_confirmation',
  '/api/email/payment-confirmed',
  '/email/payment-confirmation',
  
  '/api/email/deposit-reminder',
  '/api/email/deposit_reminder',
  '/api/email/payment-reminder',
  '/email/deposit-reminder',
  
  '/api/email/booking-confirmation',
  '/api/email/booking_confirmation',
  '/api/email/event-reminder',
  '/email/booking-confirmation',
  
  '/api/email/post-event-thanks',
  '/api/email/post_event_thanks',
  '/api/email/thank-you',
  '/email/post-event-thanks',
  
  '/api/email/follow-up',
  '/api/email/follow_up',
  '/api/email/re-engagement',
  '/email/follow-up',
  
  // Alternative patterns
  '/api/emails/',
  '/api/send/',
  '/send/',
  '/email/',
  '/emails/',
];

async function testRoute(route, method = 'GET', data = null) {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };
    
    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(`${TEST_CONFIG.baseUrl}${route}`, options);
    const responseText = await response.text();
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText.substring(0, 100) + (responseText.length > 100 ? '...' : '');
    }
    
    return {
      route,
      method,
      status: response.status,
      statusText: response.statusText,
      data: responseData,
      success: response.ok
    };
  } catch (error) {
    return {
      route,
      method,
      status: 'ERROR',
      statusText: error.message,
      data: null,
      success: false
    };
  }
}

async function discoverRoutes() {
  console.log('🔍 Discovering available routes on your email server...');
  console.log(`📡 Testing: ${TEST_CONFIG.baseUrl}`);
  console.log('=' .repeat(60));
  
  const results = [];
  
  // Test GET requests first (discovery)
  console.log('\n📥 Testing GET requests for route discovery:');
  for (const route of POSSIBLE_ROUTES) {
    const result = await testRoute(route, 'GET');
    results.push(result);
    
    const statusIcon = result.success ? '✅' : 
                      result.status === 404 ? '❌' : 
                      result.status === 405 ? '⚠️' : '🔴';
    
    console.log(`${statusIcon} ${result.method} ${result.route} → ${result.status} ${result.statusText}`);
    
    if (result.success || result.status === 405) { // 405 = Method Not Allowed (route exists but wrong method)
      console.log(`   📄 Response: ${typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.data}`);
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Test POST for promising routes
  console.log('\n📤 Testing POST requests for email endpoints:');
  const emailRoutes = POSSIBLE_ROUTES.filter(route => 
    route.includes('email') || route.includes('send')
  );
  
  const testData = {
    customerName: "Test User",
    customerEmail: TEST_CONFIG.testEmail,
    customerId: "test_001"
  };
  
  for (const route of emailRoutes) {
    const result = await testRoute(route, 'POST', testData);
    results.push(result);
    
    const statusIcon = result.success ? '✅' : 
                      result.status === 404 ? '❌' : 
                      result.status === 400 ? '⚠️' : '🔴';
    
    console.log(`${statusIcon} ${result.method} ${result.route} → ${result.status} ${result.statusText}`);
    
    if (result.success || (result.status >= 400 && result.status < 500)) {
      console.log(`   📄 Response: ${typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.data}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 DISCOVERY SUMMARY:');
  
  const workingRoutes = results.filter(r => r.success);
  const methodNotAllowed = results.filter(r => r.status === 405);
  const badRequest = results.filter(r => r.status === 400);
  
  console.log(`✅ Working routes (200-299): ${workingRoutes.length}`);
  workingRoutes.forEach(r => console.log(`   ${r.method} ${r.route}`));
  
  console.log(`⚠️  Route exists, wrong method (405): ${methodNotAllowed.length}`);
  methodNotAllowed.forEach(r => console.log(`   ${r.method} ${r.route} (try different method)`));
  
  console.log(`⚠️  Route exists, bad request (400): ${badRequest.length}`);
  badRequest.forEach(r => console.log(`   ${r.method} ${r.route} (check request format)`));
  
  if (workingRoutes.length === 0 && methodNotAllowed.length === 0 && badRequest.length === 0) {
    console.log('❌ No email routes found. Your email server may not be running or routes are named differently.');
    console.log('💡 Check: pm2 logs jumpcsra-email-server');
  } else {
    console.log('💡 Use the working routes above to update your testing dashboard.');
  }
  
  return results;
}

// Run discovery
if (typeof window === 'undefined') {
  // Check if this is the main module or being imported
  import('url').then(({ fileURLToPath }) => {
    import('path').then(({ dirname }) => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      
      if (process.argv[1] === __filename) {
        discoverRoutes().catch(console.error);
      }
    });
  }).catch(() => {
    // Fallback for older Node.js or CommonJS
    if (require.main === module) {
      discoverRoutes().catch(console.error);
    }
  });
}

// Export for browser use
if (typeof window !== 'undefined') {
  window.discoverEmailRoutes = discoverRoutes;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { discoverRoutes, testRoute, POSSIBLE_ROUTES };
}