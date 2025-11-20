const https = require('https');
const fs = require('fs');

// Read the JSON configuration
const configData = JSON.parse(fs.readFileSync('paypal-subscription-plan.json', 'utf8'));
const membershipPlan = configData.paypalConfig.membershipPlanMonthly;

// Firebase REST API endpoint
const projectId = 'pppro-b060e';
const collection = 'paypalConfig';
const document = 'membershipPlanMonthly';

const options = {
  hostname: 'firestore.googleapis.com',
  port: 443,
  path: `/v1/projects/${projectId}/databases/(default)/documents/${collection}/${document}`,
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.FIREBASE_TOKEN
  }
};

// Convert to Firestore format
const firestoreData = {
  fields: {}
};

function convertToFirestoreField(value) {
  if (typeof value === 'string') {
    return { stringValue: value };
  } else if (typeof value === 'number') {
    return { doubleValue: value };
  } else if (typeof value === 'boolean') {
    return { booleanValue: value };
  } else if (value === null) {
    return { nullValue: null };
  } else if (typeof value === 'object' && !Array.isArray(value)) {
    const fields = {};
    for (const [key, val] of Object.entries(value)) {
      fields[key] = convertToFirestoreField(val);
    }
    return { mapValue: { fields } };
  } else if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(convertToFirestoreField) } };
  }
  return { stringValue: String(value) };
}

// Convert the membership plan data
for (const [key, value] of Object.entries(membershipPlan)) {
  firestoreData.fields[key] = convertToFirestoreField(value);
}

console.log('🔑 Getting Firebase auth token...');

// First, let's get the auth token
const { exec } = require('child_process');

exec('firebase auth:print-access-token', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error getting auth token:', error);
    return;
  }
  
  const token = stdout.trim();
  console.log('✅ Got auth token');
  
  // Now make the request
  const postData = JSON.stringify(firestoreData);
  
  options.headers['Authorization'] = `Bearer ${token}`;
  options.headers['Content-Length'] = postData.length;
  
  console.log('📤 Uploading to Firestore...');
  
  const req = https.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      console.log('📋 Response status:', res.statusCode);
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log('✅ Successfully imported PayPal configuration to Firestore!');
        console.log('🆔 Plan ID:', membershipPlan.planId);
        console.log('🌍 Environment:', membershipPlan.planDetails.environment);
      } else {
        console.log('❌ Response:', responseData);
      }
    });
  });
  
  req.on('error', (error) => {
    console.error('❌ Request error:', error);
  });
  
  req.write(postData);
  req.end();
});