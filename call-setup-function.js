const https = require('https');

const postData = JSON.stringify({});

const options = {
  hostname: 'us-central1-pppro-b060e.cloudfunctions.net',
  port: 443,
  path: '/setupPayPalPlans',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

console.log('📞 Calling setupPayPalPlans function...');

const req = https.request(options, (res) => {
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('📋 Response status:', res.statusCode);
    console.log('📄 Response:', responseData);
    
    if (res.statusCode === 200) {
      console.log('✅ PayPal configuration should now be in Firestore!');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request error:', error);
});

req.write(postData);
req.end();