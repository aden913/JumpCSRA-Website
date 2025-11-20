// Debug script to check current Firestore PayPal configuration
const https = require('https');

// Test the debugSubscriptionDatabase function to see current config
const options = {
  hostname: 'us-central1-pppro-b060e.cloudfunctions.net',
  port: 443,
  path: '/debugSubscriptionDatabase',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': 2
  }
};

console.log('🔍 Checking current Firestore PayPal configuration...');

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('📋 Response status:', res.statusCode);
    console.log('📄 Current configuration:');
    
    try {
      const parsed = JSON.parse(responseData);
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.paypalConfig && parsed.paypalConfig.planId) {
        console.log('\n🔑 Current Plan ID:', parsed.paypalConfig.planId);
        
        if (parsed.paypalConfig.planId.includes('TEMP') || parsed.paypalConfig.planId.includes('SANDBOX_JUMP_CLUB')) {
          console.log('❌ This looks like a placeholder plan ID - you need a real PayPal plan ID');
        } else {
          console.log('✅ Plan ID looks valid');
        }
      }
    } catch (e) {
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error.message);
});

req.write('{}');
req.end();