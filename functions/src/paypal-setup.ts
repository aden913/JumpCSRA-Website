import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Get Firebase Admin instance (initialized in main index.ts)
function getFirestore() {
  return admin.firestore();
}

// PayPal configuration
const PAYPAL_CLIENT_ID = "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0";
const PAYPAL_CLIENT_SECRET = functions.config().paypal?.client_secret || process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";

// Get PayPal access token
async function getPayPalAccessToken(): Promise<string> {
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ PayPal token error:', data);
    throw new Error(`PayPal token error: ${data.error_description || data.error}`);
  }
  
  return data.access_token;
}

// Standalone PayPal Plans Setup Function
export const setupPayPalPlansStandalone = functions.https.onCall(async (data, context) => {
  console.log('🚀 PAYPAL SETUP: Starting PayPal plans setup...');
  
  const db = getFirestore();
  
  try {
    // Get access token
    console.log('🔑 PAYPAL SETUP: Getting access token...');
    const accessToken = await getPayPalAccessToken();
    console.log('✅ PAYPAL SETUP: Access token obtained');

    // Check if product already exists
    console.log('🔍 PAYPAL SETUP: Checking for existing product...');
    const existingProductDoc = await db.collection('paypalConfig').doc('membershipProductMonthly').get();
    
    let productId: string;
    
    if (existingProductDoc.exists) {
      const existingProduct = existingProductDoc.data();
      productId = existingProduct?.productId;
      console.log('📦 PAYPAL SETUP: Using existing product:', productId);
    } else {
      // Create product
      console.log('📦 PAYPAL SETUP: Creating new product...');
      const productData = {
        name: 'JumpCSRA Membership',
        description: 'Monthly membership for JumpCSRA services',
        type: 'SERVICE',
        category: 'SOFTWARE',
        image_url: 'https://jumpcsra.com/logo.png',
        home_url: 'https://jumpcsra.com'
      };

      console.log('📦 PAYPAL SETUP: Product data:', JSON.stringify(productData, null, 2));

      const productResponse = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `product-${Date.now()}`
        },
        body: JSON.stringify(productData)
      });

      if (!productResponse.ok) {
        const errorData = await productResponse.text();
        console.error('❌ PAYPAL SETUP: Product creation failed:', errorData);
        throw new Error(`Product creation failed: ${errorData}`);
      }

      const product = await productResponse.json();
      productId = product.id;
      console.log('✅ PAYPAL SETUP: Product created:', productId);

      // Save product to Firestore
      await db.collection('paypalConfig').doc('membershipProductMonthly').set({
        productId: productId,
        productData: product,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('💾 PAYPAL SETUP: Product saved to Firestore');
    }

    // Check if billing plan already exists
    console.log('🔍 PAYPAL SETUP: Checking for existing billing plan...');
    const existingPlanDoc = await db.collection('paypalConfig').doc('membershipPlanMonthly').get();
    
    let planId: string;
    
    if (existingPlanDoc.exists) {
      const existingPlan = existingPlanDoc.data();
      planId = existingPlan?.planId;
      console.log('📋 PAYPAL SETUP: Using existing plan:', planId);
    } else {
      // Create billing plan
      console.log('📋 PAYPAL SETUP: Creating new billing plan...');
      const planData = {
        product_id: productId,
        name: 'JumpCSRA Monthly Membership Plan',
        description: 'Monthly membership billing plan',
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: {
              interval_unit: 'MONTH',
              interval_count: 1
            },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: {
                value: '149.00',
                currency_code: 'USD'
              }
            }
          }
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: '0.00',
            currency_code: 'USD'
          },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3
        },
        taxes: {
          percentage: '0.00',
          inclusive: false
        }
      };

      console.log('📋 PAYPAL SETUP: Plan data:', JSON.stringify(planData, null, 2));

      const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `plan-${Date.now()}`
        },
        body: JSON.stringify(planData)
      });

      if (!planResponse.ok) {
        const errorData = await planResponse.text();
        console.error('❌ PAYPAL SETUP: Plan creation failed:', errorData);
        throw new Error(`Plan creation failed: ${errorData}`);
      }

      const plan = await planResponse.json();
      planId = plan.id;
      console.log('✅ PAYPAL SETUP: Plan created:', planId);

      // Save plan to Firestore
      await db.collection('paypalConfig').doc('membershipPlanMonthly').set({
        planId: planId,
        planData: plan,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('💾 PAYPAL SETUP: Plan saved to Firestore');
    }

    console.log('🎉 PAYPAL SETUP: Setup completed successfully!');
    console.log(`📦 Product ID: ${productId}`);
    console.log(`📋 Plan ID: ${planId}`);

    return {
      success: true,
      productId,
      planId,
      message: 'PayPal plans setup completed successfully'
    };

  } catch (error) {
    console.error('💥 PAYPAL SETUP: Setup failed:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError(
      'internal',
      'PayPal setup failed',
      { error: errorMessage }
    );
  }
});