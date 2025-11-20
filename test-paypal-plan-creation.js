const https = require('https');
const { Buffer } = require('buffer');

// PayPal Sandbox credentials (these should be from your sandbox app)
const PAYPAL_CLIENT_ID = 'AbGHyE5QX7nDG8YNJdMsJFhvDqfcP9xm4v4pBKd8fB6Lh7lMqCsJbS11mhvFhPwvNTjA2ZYe5IeA7D3c';
const PAYPAL_CLIENT_SECRET = 'EDmyLr1LQzIa3ACdqKzJKdnRyOQr-OGQQXr6L7PqA4NJvM8Xw7wjqP_xN3jL2CdP5A8Bv3NLx9J7-P8T';

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const data = 'grant_type=client_credentials';
  
  const options = {
    hostname: 'api-m.sandbox.paypal.com',
    port: 443,
    path: '/v1/oauth2/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
      'Content-Length': data.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed.access_token);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function createProduct() {
  const accessToken = await getAccessToken();
  
  const productData = JSON.stringify({
    name: "Jump Club Monthly Membership",
    description: "Monthly subscription to Jump Club with premium inflatable delivery and benefits",
    type: "SERVICE",
    category: "RECREATION",
    image_url: "https://jumpcsra.com/logo.png",
    home_url: "https://jumpcsra.com"
  });

  const options = {
    hostname: 'api-m.sandbox.paypal.com',
    port: 443,
    path: '/v1/catalogs/products',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'PayPal-Request-Id': `product-${Date.now()}`,
      'Prefer': 'return=representation',
      'Content-Length': productData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        console.log('Product Response Status:', res.statusCode);
        console.log('Product Response:', responseData);
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed.id);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(productData);
    req.end();
  });
}

async function createPlan(productId) {
  const accessToken = await getAccessToken();
  
  const planData = JSON.stringify({
    product_id: productId,
    name: "Jump Club Monthly Membership",
    description: "Monthly subscription to Jump Club with premium inflatable delivery and benefits",
    status: "ACTIVE",
    billing_cycles: [
      {
        frequency: {
          interval_unit: "MONTH",
          interval_count: 1
        },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: {
            value: "149.00",
            currency_code: "USD"
          }
        }
      }
    ],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: "0.00",
        currency_code: "USD"
      },
      setup_fee_failure_action: "CONTINUE",
      payment_failure_threshold: 3
    }
  });

  const options = {
    hostname: 'api-m.sandbox.paypal.com',
    port: 443,
    path: '/v1/billing/plans',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'PayPal-Request-Id': `plan-${Date.now()}`,
      'Prefer': 'return=representation',
      'Content-Length': planData.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        console.log('Plan Response Status:', res.statusCode);
        console.log('Plan Response:', responseData);
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(planData);
    req.end();
  });
}

async function main() {
  try {
    console.log('Getting access token...');
    const accessToken = await getAccessToken();
    console.log('Access token obtained successfully');
    
    console.log('Creating product...');
    const productId = await createProduct();
    console.log('Product created:', productId);
    
    console.log('Creating plan...');
    const plan = await createPlan(productId);
    console.log('Plan created:', plan.id);
    
    console.log('\nPLAN DETAILS:');
    console.log('Plan ID:', plan.id);
    console.log('Product ID:', productId);
    console.log('Status:', plan.status);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();