import * as functions from 'firebase-functions';

// Simple test function to debug PayPal API
export const testPayPalDebug = functions.https.onCall(async (data, context) => {
  console.log('STARTING PAYPAL DEBUG TEST');
  
  const PAYPAL_CLIENT_ID = "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0";
  const PAYPAL_CLIENT_SECRET = functions.config().paypal?.client_secret || "YOUR_PAYPAL_CLIENT_SECRET";
  const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";
  
  try {
    // Get access token
    console.log('Getting PayPal access token...');
    const tokenResponse = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });
    
    console.log('Token response status:', tokenResponse.status);
    const tokenData = await tokenResponse.json();
    console.log('Token data:', JSON.stringify(tokenData, null, 2));
    
    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token');
    }
    
    const accessToken = tokenData.access_token;
    console.log('Access token obtained:', accessToken ? 'YES' : 'NO');
    
    // Create simple invoice
    console.log('Creating simple invoice...');
    const simpleInvoice = {
      detail: {
        invoice_number: `TEST-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        currency_code: "USD"
      },
      invoicer: {
        name: {
          given_name: "JumpCSRA",
          surname: "Party Rentals"
        },
        email_address: "jumpcsra@gmail.com"
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              given_name: "Test",
              surname: "Customer"
            },
            email_address: "test@example.com"
          }
        }
      ],
      items: [
        {
          name: "Test Item",
          description: "Test invoice item",
          quantity: "1",
          unit_amount: {
            currency_code: "USD",
            value: "100.00"
          }
        }
      ]
    };
    
    console.log('Invoice payload:', JSON.stringify(simpleInvoice, null, 2));
    
    const createResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `TEST-${Date.now()}`
      },
      body: JSON.stringify(simpleInvoice)
    });
    
    console.log('Create response status:', createResponse.status);
    console.log('Create response ok:', createResponse.ok);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('Create error response:', errorText);
      return { success: false, error: errorText };
    }
    
    const invoice = await createResponse.json();
    console.log('PAYPAL RESPONSE:', JSON.stringify(invoice, null, 2));
    console.log('Invoice ID:', invoice.id);
    console.log('Response keys:', Object.keys(invoice));
    
    return { 
      success: true, 
      invoiceId: invoice.id,
      fullResponse: invoice
    };
    
  } catch (error) {
    console.error('PayPal test error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});