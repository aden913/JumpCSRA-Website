"use strict";
/**
 * PayPal service for JumpCSRA Cloud Functions
 * Handles PayPal invoice creation and payment processing
 */
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderDetails = exports.captureVaultOrder = exports.createVaultOrder = exports.chargeVaultedPayment = exports.createVaultCustomer = exports.processPayPalRefund = exports.createPayPalInvoice = exports.createPayPalInvoicePayload = exports.getPayPalAccessToken = void 0;
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
        // Create the invoice
        const createResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': `${data.orderID}-${Date.now()}`
            },
            body: JSON.stringify(invoicePayload)
        });
        if (!createResponse.ok) {
            const errorData = await createResponse.json();
            console.error('❌ PayPal create invoice error:', errorData);
            throw new functions.https.HttpsError('internal', `PayPal API error: ${createResponse.status} - ${errorData.message || 'Unknown error'}`);
        }
        const invoice = await createResponse.json();
        if (!invoice.id) {
            console.error('❌ No invoice ID in PayPal response:', invoice);
            throw new functions.https.HttpsError('internal', 'PayPal did not return an invoice ID');
        }
        // Send the invoice
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
        }
        else {
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
 * Process a PayPal refund for a capture
 */
const processPayPalRefund = async (captureId, amount, reason = 'Customer cancellation') => {
    try {
        const accessToken = await (0, exports.getPayPalAccessToken)();
        const refundPayload = {
            amount: {
                value: amount.toFixed(2),
                currency_code: 'USD'
            },
            note_to_payer: reason,
            invoice_id: `REFUND-${Date.now()}`
        };
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/payments/captures/${captureId}/refund`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': `refund-${Date.now()}`
            },
            body: JSON.stringify(refundPayload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('❌ PayPal refund failed:', result);
            throw new Error(`PayPal refund failed: ${result.message || 'Unknown error'}`);
        }
        return {
            success: true,
            refundId: result.id,
            status: result.status,
            amount: result.amount,
            createTime: result.create_time,
            updateTime: result.update_time
        };
    }
    catch (error) {
        console.error('❌ Error processing PayPal refund:', error);
        throw error;
    }
};
exports.processPayPalRefund = processPayPalRefund;
/**
 * Create a PayPal vault customer for recurring billing
 */
const createVaultCustomer = async (customerData) => {
    try {
        const accessToken = await (0, exports.getPayPalAccessToken)();
        const customerPayload = {
            "merchant_id": PAYPAL_CLIENT_ID,
            "external_customer_id": customerData.email,
            "given_name": customerData.firstName,
            "surname": customerData.lastName,
            "email_address": customerData.email
        };
        const response = await fetch(`${PAYPAL_BASE_URL}/v3/vault/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': `customer-${Date.now()}`
            },
            body: JSON.stringify(customerPayload)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Failed to create vault customer: ${result.message || 'Unknown error'}`);
        }
        return result.id; // Return customer ID
    }
    catch (error) {
        console.error('❌ Error creating vault customer:', error);
        throw error;
    }
};
exports.createVaultCustomer = createVaultCustomer;
/**
 * Charge a vaulted payment method for membership billing
 */
const chargeVaultedPayment = async (data) => {
    try {
        const accessToken = await (0, exports.getPayPalAccessToken)();
        const paymentPayload = {
            "intent": "CAPTURE",
            "purchase_units": [{
                    "reference_id": data.reference_id,
                    "description": data.description,
                    "amount": {
                        "currency_code": data.currency,
                        "value": data.amount.toFixed(2)
                    }
                }],
            "payment_source": {
                "stored_payment_source": {
                    "payment_initiator": "MERCHANT",
                    "payment_type": "RECURRING",
                    "usage": "SUBSEQUENT",
                    "previous_network_transaction_reference": {
                        "id": data.paymentTokenId,
                        "network": "VISA" // This should be dynamic based on card type
                    }
                }
            }
        };
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': `charge-${Date.now()}`
            },
            body: JSON.stringify(paymentPayload)
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Failed to charge vaulted payment: ${result.message || 'Unknown error'}`);
        }
        // Capture the payment
        const captureResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${result.id}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
                'PayPal-Request-Id': `capture-${Date.now()}`
            }
        });
        const captureResult = await captureResponse.json();
        if (!captureResponse.ok) {
            throw new Error(`Failed to capture payment: ${captureResult.message || 'Unknown error'}`);
        }
        return captureResult;
    }
    catch (error) {
        console.error('❌ Error charging vaulted payment:', error);
        throw error;
    }
};
exports.chargeVaultedPayment = chargeVaultedPayment;
/**
 * Create PayPal order with vault attributes for card saving
 * @param orderData - Order details including amount, saveCard checkbox, customerId
 * @returns PayPal order response
 */
const createVaultOrder = async (orderData) => {
    try {
        console.log('🏦 Creating PayPal order with vault attributes:', {
            amount: orderData.amount,
            saveCard: orderData.saveCard,
            customerId: orderData.customerId,
            orderId: orderData.orderId
        });
        const accessToken = await (0, exports.getPayPalAccessToken)();
        const orderPayload = {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: orderData.orderId || `order-${Date.now()}`,
                    amount: {
                        currency_code: orderData.currency || 'USD',
                        value: orderData.amount
                    }
                }
            ]
        };
        // Add vault attributes if user wants to save card
        if (orderData.saveCard) {
            orderPayload.payment_source = {
                card: {
                    attributes: {
                        vault: {
                            store_in_vault: 'ON_SUCCESS'
                        }
                    }
                }
            };
            // For returning customers, include their customer ID
            if (orderData.customerId) {
                orderPayload.payment_source.card.attributes.vault.customer_id = orderData.customerId;
            }
        }
        console.log('📤 Sending order creation request:', JSON.stringify(orderPayload, null, 2));
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(orderPayload)
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('❌ Order creation failed:', result);
            throw new Error(`Failed to create order: ${result.message || 'Unknown error'}`);
        }
        console.log('✅ Order created successfully:', result.id);
        return result;
    }
    catch (error) {
        console.error('❌ Error creating vault order:', error);
        throw error;
    }
};
exports.createVaultOrder = createVaultOrder;
/**
 * Capture PayPal order and retrieve vault information
 * @param orderId - PayPal order ID to capture
 * @returns Capture response with vault details
 */
const captureVaultOrder = async (orderId) => {
    var _a, _b, _c, _d;
    try {
        console.log('💰 Capturing PayPal order:', orderId);
        const accessToken = await (0, exports.getPayPalAccessToken)();
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('❌ Capture failed:', result);
            throw new Error(`Failed to capture order: ${result.message || 'Unknown error'}`);
        }
        console.log('✅ Order captured successfully');
        console.log('💳 Payment source:', JSON.stringify(result.payment_source, null, 2));
        // Check for vault information
        if ((_c = (_b = (_a = result.payment_source) === null || _a === void 0 ? void 0 : _a.card) === null || _b === void 0 ? void 0 : _b.attributes) === null || _c === void 0 ? void 0 : _c.vault) {
            const vault = result.payment_source.card.attributes.vault;
            console.log('🔐 Vault information found:', {
                vaultId: vault.id,
                customerId: (_d = vault.customer) === null || _d === void 0 ? void 0 : _d.id,
                status: vault.status
            });
        }
        else {
            console.log('ℹ️ No vault information in capture response');
        }
        return result;
    }
    catch (error) {
        console.error('❌ Error capturing vault order:', error);
        throw error;
    }
};
exports.captureVaultOrder = captureVaultOrder;
/**
 * Get full order details (useful when vault status is APPROVED and vault ID isn't immediately available)
 * @param orderId - PayPal order ID
 * @returns Full order details
 */
const getOrderDetails = async (orderId) => {
    try {
        console.log('🔍 Fetching order details:', orderId);
        const accessToken = await (0, exports.getPayPalAccessToken)();
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const result = await response.json();
        if (!response.ok) {
            console.error('❌ Failed to get order details:', result);
            throw new Error(`Failed to get order details: ${result.message || 'Unknown error'}`);
        }
        return result;
    }
    catch (error) {
        console.error('❌ Error getting order details:', error);
        throw error;
    }
};
exports.getOrderDetails = getOrderDetails;
//# sourceMappingURL=paypalService.js.map