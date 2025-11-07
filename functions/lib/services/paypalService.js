"use strict";
/**
 * PayPal service for JumpCSRA Cloud Functions
 * Handles PayPal invoice creation and payment processing
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.testPayPalConnection = exports.createPayPalInvoice = exports.createPayPalInvoicePayload = exports.getPayPalAccessToken = void 0;
const functions = require("firebase-functions");
// PayPal configuration
const PAYPAL_CLIENT_ID = "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0";
const PAYPAL_CLIENT_SECRET = ((_a = functions.config().paypal) === null || _a === void 0 ? void 0 : _a.client_secret) || "YOUR_PAYPAL_CLIENT_SECRET";
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use https://api-m.paypal.com for production
/**
 * Get PayPal access token
 */
const getPayPalAccessToken = async () => {
    try {
        console.log('🔑 Getting PayPal access token...');
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
        const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'grant_type=client_credentials'
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ PayPal auth failed:', response.status, errorText);
            throw new Error(`PayPal auth failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        console.log('✅ PayPal access token obtained');
        return data.access_token;
    }
    catch (error) {
        console.error('❌ Error getting PayPal access token:', error);
        throw error;
    }
};
exports.getPayPalAccessToken = getPayPalAccessToken;
/**
 * Convert order data to PayPal invoice format
 */
const createPayPalInvoicePayload = (data) => {
    const items = [];
    // Add rental items
    data.rentalItems.forEach(item => {
        items.push({
            name: item.name,
            description: `${item.duration ? `Duration: ${item.duration}` : ''}${item.wetDry ? ` - ${item.wetDry}` : ''}`,
            quantity: item.quantity.toString(),
            unit_amount: {
                currency_code: "USD",
                value: (item.price / item.quantity).toFixed(2)
            }
        });
    });
    // Add last minute additions
    data.lastMinuteAdditions.forEach(item => {
        items.push({
            name: item.name,
            description: "Last minute addition",
            quantity: item.quantity.toString(),
            unit_amount: {
                currency_code: "USD",
                value: (item.price / item.quantity).toFixed(2)
            }
        });
    });
    // Add surface adjustment if any
    if (data.surfaceAdjustment !== 0) {
        items.push({
            name: "Surface Adjustment",
            description: `Surface: ${data.surface || 'N/A'}`,
            quantity: "1",
            unit_amount: {
                currency_code: "USD",
                value: data.surfaceAdjustment.toFixed(2)
            }
        });
    }
    // Add time adjustment if any
    if (data.timeAdjustment !== 0) {
        items.push({
            name: "Time Adjustment",
            description: "Pricing adjustment for event timing",
            quantity: "1",
            unit_amount: {
                currency_code: "USD",
                value: data.timeAdjustment.toFixed(2)
            }
        });
    }
    // Add delivery cost if any
    if (data.deliveryCost > 0) {
        items.push({
            name: "Delivery Service",
            description: `Delivery to: ${data.deliveryAddress || 'Specified address'}`,
            quantity: "1",
            unit_amount: {
                currency_code: "USD",
                value: data.deliveryCost.toFixed(2)
            }
        });
    }
    // Add gift cards as line items (showing what was used)
    data.giftCards.forEach(giftCard => {
        items.push({
            name: `Gift Card Applied: ${giftCard.code}`,
            description: `Gift card balance used${giftCard.isPromotional ? ' (Promotional)' : ''}`,
            quantity: "1",
            unit_amount: {
                currency_code: "USD",
                value: (-Math.min(giftCard.balance, data.totalAmount)).toFixed(2)
            }
        });
    });
    const nameParts = data.recipientName.trim().split(' ');
    const firstName = nameParts[0] || data.recipientName;
    const lastName = nameParts.slice(1).join(' ') || '';
    return {
        detail: {
            invoice_number: `JC-${data.orderID}`,
            reference: data.orderID,
            invoice_date: new Date().toISOString().split('T')[0],
            currency_code: "USD",
            note: `Order for ${data.recipientName}. Event date: ${data.eventDate ? new Date(data.eventDate).toLocaleDateString() : 'TBD'}. Payment type: ${data.paymentType}. ${data.remainingBalance > 0 ? `Remaining balance: $${data.remainingBalance.toFixed(2)}` : 'Paid in full.'}`,
            memo: `JumpCSRA Order ${data.orderID} - ${data.paymentType === 'deposit' ? 'Deposit Payment' : 'Full Payment'}`,
            payment_term: {
                term_type: "NET_10"
            }
        },
        invoicer: {
            name: {
                given_name: "JumpCSRA",
                surname: "Party Rentals"
            },
            address: {
                address_line_1: "123 Business St",
                admin_area_2: "Columbia",
                admin_area_1: "SC",
                postal_code: "29203",
                country_code: "US"
            },
            email_address: "jumpcsra@gmail.com",
            phones: [{
                    country_code: "1",
                    national_number: "8032210466",
                    phone_type: "BUSINESS"
                }],
            website: "https://jumpcsra.com"
        },
        primary_recipients: [{
                billing_info: Object.assign({ name: {
                        given_name: firstName,
                        surname: lastName
                    }, email_address: data.recipientEmail }, (data.deliveryAddress && {
                    address: {
                        address_line_1: data.deliveryAddress.split(',')[0] || data.deliveryAddress,
                        admin_area_2: "Columbia",
                        admin_area_1: "SC",
                        postal_code: "29203",
                        country_code: "US"
                    }
                }))
            }],
        items: items,
        configuration: {
            partial_payment: {
                allow_partial_payment: data.remainingBalance > 0,
                minimum_amount_due: {
                    currency_code: "USD",
                    value: data.amountPaid.toFixed(2)
                }
            },
            allow_tip: false,
            tax_calculated_after_discount: true,
            tax_inclusive: false
        }
    };
};
exports.createPayPalInvoicePayload = createPayPalInvoicePayload;
/**
 * Create PayPal invoice
 */
const createPayPalInvoice = async (data) => {
    console.log('📧 Creating PayPal invoice for order:', data.orderID);
    // Validate input data
    if (!data.recipientEmail || !data.orderID || typeof data.totalAmount !== 'number') {
        console.error('❌ Invalid PayPal invoice data:', {
            hasEmail: !!data.recipientEmail,
            hasOrderID: !!data.orderID,
            totalAmountType: typeof data.totalAmount
        });
        throw new functions.https.HttpsError('invalid-argument', 'Missing required invoice data.');
    }
    try {
        // Get PayPal access token
        const accessToken = await (0, exports.getPayPalAccessToken)();
        // Create invoice payload
        const invoicePayload = (0, exports.createPayPalInvoicePayload)(data);
        console.log('📋 Invoice payload created for order:', data.orderID);
        // Create the invoice
        console.log('📤 Creating invoice via PayPal API...');
        const createResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': `${data.orderID}-${Date.now()}`
            },
            body: JSON.stringify(invoicePayload)
        });
        console.log('📋 PayPal response status:', createResponse.status);
        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            console.error('❌ PayPal create invoice error:', errorData);
            throw new functions.https.HttpsError('internal', `PayPal API error: ${createResponse.status} - ${errorData.message || 'Unknown error'}`);
        }
        const invoice = await createResponse.json();
        console.log('✅ Invoice created with ID:', invoice.id);
        if (!invoice.id) {
            console.error('❌ No invoice ID in PayPal response:', invoice);
            throw new functions.https.HttpsError('internal', 'PayPal did not return an invoice ID');
        }
        // Send the invoice
        console.log('📤 Sending PayPal invoice...');
        const sendResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoice.id}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                send_to_recipient: true,
                send_to_invoicer: false
            })
        });
        if (!sendResponse.ok) {
            const sendErrorData = await sendResponse.json();
            console.error('❌ PayPal send invoice error:', sendErrorData);
            console.log('⚠️ Invoice created but send failed - invoice can be sent manually');
        }
        else {
            console.log('✅ PayPal invoice sent successfully');
        }
        return invoice;
    }
    catch (error) {
        console.error('❌ Error creating PayPal invoice:', error);
        throw error;
    }
};
exports.createPayPalInvoice = createPayPalInvoice;
/**
 * Test PayPal connection and create a simple test invoice
 */
const testPayPalConnection = async () => {
    console.log('🧪 Testing PayPal connection...');
    try {
        // Get access token
        const accessToken = await (0, exports.getPayPalAccessToken)();
        // Create simple test invoice
        const testInvoice = {
            detail: {
                invoice_number: `TEST-${Date.now()}`,
                invoice_date: new Date().toISOString().split('T')[0],
                currency_code: "USD"
            },
            invoicer: {
                name: {
                    given_name: "JumpCSRA",
                    surname: "Test"
                },
                email_address: "jumpcsra@gmail.com"
            },
            primary_recipients: [{
                    billing_info: {
                        name: {
                            given_name: "Test",
                            surname: "Customer"
                        },
                        email_address: "test@example.com"
                    }
                }],
            items: [{
                    name: "Test Item",
                    description: "PayPal connection test",
                    quantity: "1",
                    unit_amount: {
                        currency_code: "USD",
                        value: "1.00"
                    }
                }]
        };
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': `test-${Date.now()}`
            },
            body: JSON.stringify(testInvoice)
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ PayPal test failed:', errorData);
            throw new Error(`PayPal test failed: ${response.status}`);
        }
        const result = await response.json();
        console.log('✅ PayPal connection test successful');
        return {
            success: true,
            message: 'PayPal connection working',
            testInvoiceId: result.id
        };
    }
    catch (error) {
        console.error('❌ PayPal connection test failed:', error);
        return {
            success: false,
            message: error.message,
            error: error
        };
    }
};
exports.testPayPalConnection = testPayPalConnection;
//# sourceMappingURL=paypalService.js.map