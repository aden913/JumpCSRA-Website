import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

// Export test function
export { testFunction } from './test';
// Export standalone PayPal setup function
export { setupPayPalPlansStandalone } from './paypal-setup';

export const testPayPalDebug = functions.https.onCall(async (data, context) => {
  
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
    
    if (!tokenResponse.ok) {
      console.log('Token error:', JSON.stringify(tokenData, null, 2));
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
    console.log('PAYPAL RESPONSE FULL:', JSON.stringify(invoice, null, 2));
    console.log('PAYPAL Invoice ID:', invoice.id);
    console.log('PAYPAL Response keys:', Object.keys(invoice));
    
    return { 
      success: true, 
      invoiceId: invoice.id,
      responseKeys: Object.keys(invoice),
      hasId: !!invoice.id
    };
    
  } catch (error: any) {
    console.error('PayPal test error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
});

// Initialize Firebase Admin
admin.initializeApp();

// Initialize SendGrid with API key from environment variables
const sendGridApiKey = functions.config().sendgrid?.api_key;
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
}

// PayPal configuration
const PAYPAL_CLIENT_ID = "AWT5np0jyr8BIdzyJvoWm0X9158l2F0l0rPjE6q925D5VnZVix4uwDRSivBe8Vs4sjCO8Hu-io5mSxM0";
const PAYPAL_CLIENT_SECRET = functions.config().paypal?.client_secret || "YOUR_PAYPAL_CLIENT_SECRET";
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use https://api-m.paypal.com for production

// Enhanced HTML email template with invoice-style formatting
const generateEnhancedOrderEmailHTML = (data: OrderConfirmationEmailData): string => {
  const hasRentals = data.rentalItems.length > 0;
  const hasGiftCards = data.giftCards.length > 0;
  
  // Generate status banner
  const getStatusBanner = (status: string, requiresPhoneCall: boolean) => {
    if (requiresPhoneCall) {
      return `<div class="status-banner status-deferred">📞 Call Required - Since your event is within 2 days, we'll contact you to confirm details.</div>`;
    }
    
    let statusClass = 'status-confirmed';
    let statusMessage = '✅ Booking Confirmed - Your order is confirmed!';
    
    switch (status) {
      case 'confirmed':
        statusClass = 'status-confirmed';
        statusMessage = '✅ Booking Confirmed - Your order is confirmed!';
        break;
      case 'pending':
        statusClass = 'status-pending';
        statusMessage = '⏳ Booking Pending - We\'ll review and confirm your order soon.';
        break;
      case 'requires_call':
        statusClass = 'status-deferred';
        statusMessage = '📞 Call Required - Since your event is within 2 days, we\'ll contact you to confirm details.';
        break;
      default:
        statusClass = 'status-pending';
        statusMessage = '📋 Order Received - Thank you for your order!';
    }
    
    return `<div class="status-banner ${statusClass}">${statusMessage}</div>`;
  };
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation & Invoice - JumpCSRA</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .invoice-container { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .invoice-header { background: #f8f9fa; padding: 20px; border-bottom: 2px solid #667eea; }
        .content { padding: 30px; }
        .section { margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea; }
        .section h3 { margin-top: 0; color: #667eea; }
        .invoice-details { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .invoice-details div { flex: 1; }
        .item-list { list-style: none; padding: 0; background: white; border-radius: 5px; }
        .item-list li { padding: 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
        .item-list li:last-child { border-bottom: none; }
        .item-list li:nth-child(even) { background: #fafafa; }
        .total-section { background: #667eea; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .total-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .total-row.grand-total { font-size: 20px; font-weight: bold; border-top: 2px solid rgba(255,255,255,0.3); padding-top: 10px; margin-top: 15px; }
        .gift-card { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; margin: 15px 0; border-radius: 10px; text-align: center; }
        .gift-card.promotional { background: linear-gradient(135deg, #fd7e14 0%, #e63946 100%); }
        .gift-card-code { font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 5px; }
        .gift-card-balance { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .status-banner { padding: 15px; border-radius: 5px; text-align: center; font-weight: bold; margin: 20px 0; }
        .status-confirmed { background: #d4edda; color: #155724; border: 2px solid #c3e6cb; }
        .status-pending { background: #fff3cd; color: #856404; border: 2px solid #ffeaa7; }
        .status-deferred { background: #f8d7da; color: #721c24; border: 2px solid #f5c6cb; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; color: #666; border-radius: 8px; }
        .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
        .company-info { background: white; padding: 20px; text-align: center; border-top: 1px solid #eee; }
        @media (max-width: 600px) {
          .invoice-details { flex-direction: column; }
          .total-row { font-size: 14px; }
          .gift-card-code { font-size: 18px; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="header">
            <h1>🎉 Order Confirmation & Invoice</h1>
            <p>Thank you for your order, ${data.recipientName}!</p>
        </div>
        
        <div class="invoice-header">
            <div class="invoice-details">
                <div>
                    <strong>Invoice #:</strong> JC-${data.orderID}<br>
                    <strong>Order Date:</strong> ${new Date(data.orderDate).toLocaleDateString()}<br>
                    <strong>Customer:</strong> ${data.recipientName}
                </div>
                <div style="text-align: right;">
                    <strong>JumpCSRA Party Rentals</strong><br>
                    jumpcsra@gmail.com<br>
                    (803) 221-0466
                </div>
            </div>
        </div>
        
        <div class="content">
            ${getStatusBanner(data.bookingStatus, data.requiresPhoneCall || false)}
            
            ${hasRentals ? `
            <div class="section">
                <h3>🎪 Event Details</h3>
                ${data.eventDate ? `<p><strong>Event Date:</strong> ${data.eventDate}</p>` : ''}
                ${data.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${data.deliveryAddress}</p>` : ''}
                ${data.deliveryTime ? `<p><strong>Delivery Time:</strong> ${data.deliveryTime}</p>` : ''}
                ${data.duration ? `<p><strong>Duration:</strong> ${data.duration}</p>` : ''}
                ${data.surface ? `<p><strong>Surface:</strong> ${data.surface}</p>` : ''}
            </div>
            
            <div class="section">
                <h3>📦 Items Ordered</h3>
                <ul class="item-list">
                    ${data.rentalItems.map(item => `
                        <li>
                            <span>
                                <strong>${item.name}</strong>
                                ${item.duration ? `<br><small>${item.duration}</small>` : ''}
                                ${item.wetDry ? `<br><small>${item.wetDry}</small>` : ''}
                                <br><small>Qty: ${item.quantity}</small>
                            </span>
                            <span><strong>$${item.price.toFixed(2)}</strong></span>
                        </li>
                    `).join('')}
                    ${data.lastMinuteAdditions.map(item => `
                        <li>
                            <span>
                                <strong>${item.name}</strong>
                                <br><small>Qty: ${item.quantity}</small>
                            </span>
                            <span><strong>$${item.price.toFixed(2)}</strong></span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
            
            <div class="section">
                <h3>💰 Payment Summary</h3>
                <div class="total-section">
                    <div class="total-row">
                        <span>Subtotal:</span>
                        <span>$${data.subtotal.toFixed(2)}</span>
                    </div>
                    ${data.surfaceAdjustment > 0 ? `
                    <div class="total-row">
                        <span>Surface Adjustment:</span>
                        <span>$${data.surfaceAdjustment.toFixed(2)}</span>
                    </div>` : ''}
                    ${data.timeAdjustment > 0 ? `
                    <div class="total-row">
                        <span>Time Adjustment:</span>
                        <span>$${data.timeAdjustment.toFixed(2)}</span>
                    </div>` : ''}
                    ${data.deliveryCost > 0 ? `
                    <div class="total-row">
                        <span>Delivery:</span>
                        <span>$${data.deliveryCost.toFixed(2)}</span>
                    </div>` : ''}
                    <div class="total-row grand-total">
                        <span>Total Amount:</span>
                        <span>$${data.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
                
                <p><strong>Payment Type:</strong> ${data.paymentType === 'deposit' ? '50% Deposit' : 'Full Payment'}</p>
                <p><strong>Amount Paid:</strong> $${data.amountPaid.toFixed(2)} (${data.paymentMethod})</p>
                ${data.remainingBalance > 0 ? `<p><strong>Remaining Balance:</strong> $${data.remainingBalance.toFixed(2)} <em>(due before event)</em></p>` : ''}
            </div>
            
            ${hasGiftCards ? `
            <div class="section">
                <h3>🎁 Gift Cards Included</h3>
                ${data.giftCards.map(giftCard => `
                    <div class="gift-card ${giftCard.isPromotional ? 'promotional' : ''}">
                        <h4>${giftCard.isPromotional ? '🎉 Promotional Gift Card' : '🎁 Gift Card'}</h4>
                        <div class="gift-card-balance">$${giftCard.balance.toFixed(2)}</div>
                        <div class="gift-card-code">${giftCard.code}</div>
                        <p><strong>Expires:</strong> ${giftCard.expirationDate}</p>
                        ${giftCard.isPromotional && giftCard.promotionalMessage ? `
                            <p><em>${giftCard.promotionalMessage}</em></p>
                        ` : ''}
                        ${giftCard.recipientEmail && giftCard.recipientEmail !== data.recipientEmail ? `
                            <p><strong>Gift Recipient:</strong> ${giftCard.recipientEmail}</p>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
        </div>
        
        <div class="company-info">
            <h3>JumpCSRA Party Rentals</h3>
            <p><strong>📧 Questions?</strong> Reply to this email or contact us at jumpcsra@gmail.com</p>
            <p><strong>📞 Phone:</strong> (803) 221-0466</p>
            <p><strong>🌐 Website:</strong> jumpcsra.com</p>
            <p style="margin-top: 20px; font-size: 14px; color: #666;">
                Thank you for choosing JumpCSRA Party Rentals! We're excited to make your event unforgettable.
            </p>
        </div>
    </div>
</body>
</html>`;
};

// Order confirmation email interfaces
interface GiftCardInfo {
  code: string;
  balance: number;
  expirationDate: string;
  isPromotional?: boolean;
  promotionalMessage?: string;
  recipientEmail?: string;
}

interface OrderConfirmationEmailData {
  recipientEmail: string;
  recipientName: string;
  orderID: string;
  orderDate: string;
  
  // Order details
  eventDate?: string;
  deliveryAddress?: string;
  deliveryTime?: string;
  duration?: string;
  surface?: string;
  
  // Items
  rentalItems: Array<{
    name: string;
    quantity: number;
    price: number;
    duration?: string;
    wetDry?: string;
  }>;
  
  lastMinuteAdditions: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  
  // Pricing breakdown
  subtotal: number;
  surfaceAdjustment: number;
  timeAdjustment: number;
  deliveryCost: number;
  totalAmount: number;
  
  // Payment info
  paymentType: 'full' | 'deposit';
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string;
  
  // Gift cards (if any)
  giftCards: GiftCardInfo[];
  
  // Booking status
  bookingStatus: string;
  requiresPhoneCall?: boolean;
}

// Order confirmation email HTML generation
const generateOrderConfirmationEmailHTML = (data: OrderConfirmationEmailData): string => {
  const hasRentals = data.rentalItems.length > 0 || data.lastMinuteAdditions.length > 0;
  const hasGiftCards = data.giftCards.length > 0;
  
  const getStatusBanner = (status: string, requiresPhoneCall?: boolean): string => {
    let statusClass = 'status-confirmed';
    let statusMessage = '';
    
    switch (status.toLowerCase()) {
      case 'confirmed':
        statusClass = 'status-confirmed';
        statusMessage = '✅ Order Confirmed - Your booking is confirmed and ready!';
        break;
      case 'pending':
        statusClass = 'status-pending';
        statusMessage = '⏳ Order Pending - We\'re processing your order and will confirm shortly.';
        break;
      case 'deferred':
        statusClass = 'status-deferred';
        statusMessage = '📞 Call Required - Since your event is within 2 days, we\'ll contact you to confirm details.';
        break;
      default:
        statusClass = 'status-pending';
        statusMessage = '📋 Order Received - Thank you for your order!';
    }
    
    return `<div class="status-banner ${statusClass}">${statusMessage}</div>`;
  };
  
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation - JumpCSRA</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .section { margin: 25px 0; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #667eea; }
        .section h3 { margin-top: 0; color: #667eea; }
        .item-list { list-style: none; padding: 0; }
        .item-list li { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; }
        .item-list li:last-child { border-bottom: none; }
        .total-row { font-weight: bold; font-size: 18px; background: #667eea; color: white; padding: 15px; border-radius: 5px; text-align: center; margin: 15px 0; }
        .gift-card { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; margin: 15px 0; border-radius: 10px; text-align: center; }
        .gift-card.promotional { background: linear-gradient(135deg, #fd7e14 0%, #e63946 100%); }
        .gift-card-code { font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 10px 0; }
        .gift-card-balance { font-size: 32px; font-weight: bold; margin: 10px 0; }
        .status-banner { padding: 15px; border-radius: 5px; text-align: center; font-weight: bold; margin: 20px 0; }
        .status-confirmed { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .status-pending { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        .status-deferred { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
        .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 Order Confirmation</h1>
        <p>Thank you for your order, ${data.recipientName}!</p>
        <p><strong>Order #${data.orderID}</strong></p>
        <p>Placed on ${new Date(data.orderDate).toLocaleDateString()}</p>
    </div>
    
    <div class="content">
        ${getStatusBanner(data.bookingStatus, data.requiresPhoneCall)}
        
        ${hasRentals ? `
        <div class="section">
            <h3>🎪 Event Details</h3>
            ${data.eventDate ? `<p><strong>Event Date:</strong> ${data.eventDate}</p>` : ''}
            ${data.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${data.deliveryAddress}</p>` : ''}
            ${data.deliveryTime ? `<p><strong>Delivery Time:</strong> ${data.deliveryTime}</p>` : ''}
            ${data.duration ? `<p><strong>Duration:</strong> ${data.duration}</p>` : ''}
            ${data.surface ? `<p><strong>Surface:</strong> ${data.surface}</p>` : ''}
        </div>
        
        <div class="section">
            <h3>📦 Items Ordered</h3>
            <ul class="item-list">
                ${data.rentalItems.map(item => `
                    <li>
                        <span>${item.name} ${item.duration ? `(${item.duration})` : ''} ${item.wetDry ? `- ${item.wetDry}` : ''} x${item.quantity}</span>
                        <span>$${item.price.toFixed(2)}</span>
                    </li>
                `).join('')}
                ${data.lastMinuteAdditions.map(item => `
                    <li>
                        <span>${item.name} x${item.quantity}</span>
                        <span>$${item.price.toFixed(2)}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
        ` : ''}
        
        <div class="section">
            <h3>💰 Payment Summary</h3>
            <ul class="item-list">
                <li><span>Subtotal:</span><span>$${data.subtotal.toFixed(2)}</span></li>
                ${data.surfaceAdjustment > 0 ? `<li><span>Surface Adjustment:</span><span>$${data.surfaceAdjustment.toFixed(2)}</span></li>` : ''}
                ${data.timeAdjustment > 0 ? `<li><span>Time Adjustment:</span><span>$${data.timeAdjustment.toFixed(2)}</span></li>` : ''}
                ${data.deliveryCost > 0 ? `<li><span>Delivery:</span><span>$${data.deliveryCost.toFixed(2)}</span></li>` : ''}
            </ul>
            <div class="total-row">Total: $${data.totalAmount.toFixed(2)}</div>
            
            <p><strong>Payment Type:</strong> ${data.paymentType === 'deposit' ? '50% Deposit' : 'Full Payment'}</p>
            <p><strong>Amount Paid:</strong> $${data.amountPaid.toFixed(2)} (${data.paymentMethod})</p>
            ${data.remainingBalance > 0 ? `<p><strong>Remaining Balance:</strong> $${data.remainingBalance.toFixed(2)}</p>` : ''}
        </div>
        
        ${hasGiftCards ? `
        <div class="section">
            <h3>🎁 Gift Cards</h3>
            ${data.giftCards.map(giftCard => `
                <div class="gift-card ${giftCard.isPromotional ? 'promotional' : ''}">
                    <h4>${giftCard.isPromotional ? '🎉 Promotional Gift Card' : '🎁 Gift Card'}</h4>
                    <div class="gift-card-code">${giftCard.code}</div>
                    <div class="gift-card-balance">$${giftCard.balance.toFixed(2)}</div>
                    <p><strong>Expires:</strong> ${giftCard.expirationDate}</p>
                    ${giftCard.isPromotional ? `
                        <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 5px; margin-top: 10px;">
                            <strong>⚠️ GIFT CARD NOTICE:</strong><br>
                            ${giftCard.promotionalMessage || 'This promotional gift card must be used by someone else and cannot be used by the purchaser.'}
                        </div>
                    ` : ''}
                    ${giftCard.recipientEmail && giftCard.recipientEmail !== data.recipientEmail ? `
                        <p><strong>🎁 Recipient:</strong> ${giftCard.recipientEmail}</p>
                    ` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="section">
            <h3>📋 What's Next?</h3>
            ${data.requiresPhoneCall ? `
                <p><strong>📞 Phone Call Required:</strong> Since your event is within 2 days, we'll contact you to confirm details and arrange delivery.</p>
            ` : ''}
            ${data.remainingBalance > 0 ? `
                <p><strong>💳 Remaining Payment:</strong> The remaining balance of $${data.remainingBalance.toFixed(2)} will be collected before or at the time of delivery.</p>
            ` : ''}
            <p><strong>📧 Questions?</strong> Reply to this email or contact us at jumpcsra@gmail.com</p>
        </div>
        
        <div style="text-align: center;">
            <a href="https://jumpcsra.com" class="button">Visit Our Website</a>
        </div>
        
        <div class="footer">
            <p>Thank you for choosing JumpCSRA Party Rentals!</p>
            <p>Making Your Events Unforgettable</p>
            <p>jumpcsra@gmail.com | jumpcsra.com</p>
        </div>
    </div>
</body>
</html>`;
};

interface GiftCardEmailData {
  recipientEmail: string;
  recipientName: string;
  giftCardCode: string;
  giftCardBalance: number;
  expirationDate: string;
  purchaseDate: string;
}

const generateGiftCardEmailHTML = (data: GiftCardEmailData): string => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your JumpCSRA Gift Card</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px; 
            }
            .header { 
                background: linear-gradient(135deg, #ff6b6b, #4ecdc4); 
                color: white; 
                text-align: center; 
                padding: 30px; 
                border-radius: 10px 10px 0 0; 
            }
            .content { 
                background: #f9f9f9; 
                padding: 30px; 
                border-radius: 0 0 10px 10px; 
                border: 1px solid #ddd; 
            }
            .gift-card-box { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 25px; 
                border-radius: 10px; 
                text-align: center; 
                margin: 20px 0; 
                box-shadow: 0 4px 15px rgba(0,0,0,0.1); 
            }
            .gift-card-code { 
                font-size: 24px; 
                font-weight: bold; 
                letter-spacing: 3px; 
                background: rgba(255,255,255,0.2); 
                padding: 15px; 
                border-radius: 8px; 
                margin: 15px 0; 
                border: 2px dashed rgba(255,255,255,0.5); 
            }
            .balance { 
                font-size: 28px; 
                font-weight: bold; 
                color: #4CAF50; 
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3); 
            }
            .instructions { 
                background: #e8f5e8; 
                border-left: 5px solid #4CAF50; 
                padding: 20px; 
                margin: 20px 0; 
                border-radius: 0 5px 5px 0; 
            }
            .instruction-item { 
                margin: 15px 0; 
                padding-left: 25px; 
                position: relative; 
            }
            .instruction-item:before { 
                content: "✓"; 
                position: absolute; 
                left: 0; 
                color: #4CAF50; 
                font-weight: bold; 
                font-size: 18px; 
            }
            .footer { 
                text-align: center; 
                margin-top: 30px; 
                padding-top: 20px; 
                border-top: 1px solid #ddd; 
                color: #666; 
                font-size: 14px; 
            }
            .warning { 
                background: #fff3cd; 
                border: 1px solid #ffeaa7; 
                color: #856404; 
                padding: 15px; 
                border-radius: 5px; 
                margin: 20px 0; 
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎉 Your JumpCSRA Gift Card!</h1>
            <p>Thank you for your purchase!</p>
        </div>
        
        <div class="content">
            <p>Hi ${data.recipientName},</p>
            
            <p>Congratulations! Your gift card purchase has been confirmed. Here are your gift card details:</p>
            
            <div class="gift-card-box">
                <h2>🎁 Gift Card Details</h2>
                <div class="gift-card-code">${data.giftCardCode}</div>
                <div class="balance">$${data.giftCardBalance.toFixed(2)}</div>
                <p><strong>Purchased:</strong> ${formatDate(data.purchaseDate)}</p>
                <p><strong>Expires:</strong> ${formatDate(data.expirationDate)}</p>
            </div>
            
            <div class="instructions">
                <h3>💡 How to Use Your Gift Card:</h3>
                
                <div class="instruction-item">
                    <strong>During Checkout:</strong> When placing an order on our website, enter your gift card code during the payment process to apply the balance to your order.
                </div>
                
                <div class="instruction-item">
                    <strong>Add to Wallet:</strong> Visit your profile page → Payment Information tab → enter your gift card code to add the balance to your wallet for easy future use.
                </div>
                
                <div class="instruction-item">
                    <strong>Check Balance:</strong> Go to your profile → Payment Information tab and use the gift card balance checker to see your current balance and usage history.
                </div>
                
                <div class="instruction-item">
                    <strong>Call for Assistance:</strong> Contact us at (803) 221-0466 if you need help using your gift card.
                </div>
            </div>
            
            <div class="warning">
                <strong>⚠️ Important:</strong> Please save this email! Your gift card code is required to use your gift card. This gift card expires in one year from the purchase date.
            </div>
            
            <p>We can't wait to help make your next event amazing! Visit our website to browse our selection of bounce houses, water slides, and party essentials.</p>
            
            <p>Thank you for choosing JumpCSRA!</p>
        </div>
        
        <div class="footer">
            <p>JumpCSRA Party Rentals</p>
            <p>Phone: (803) 221-0466</p>
            <p>This is an automated email. Please do not reply to this message.</p>
        </div>
    </body>
    </html>
  `;
};

const generateGiftCardEmailText = (data: GiftCardEmailData): string => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return `
JumpCSRA Gift Card - Thank You for Your Purchase!

Hi ${data.recipientName},

Congratulations! Your gift card purchase has been confirmed.

GIFT CARD DETAILS:
Code: ${data.giftCardCode}
Balance: $${data.giftCardBalance.toFixed(2)}
Purchased: ${formatDate(data.purchaseDate)}
Expires: ${formatDate(data.expirationDate)}

HOW TO USE YOUR GIFT CARD:

1. During Checkout: When placing an order on our website, enter your gift card code during the payment process.

2. Add to Wallet: Visit your profile page → Payment Information tab → enter your gift card code to add the balance to your wallet.

3. Check Balance: Go to your profile → Payment Information tab and use the gift card balance checker.

4. Call for Assistance: Contact us at (803) 221-0466 if you need help.

IMPORTANT: Please save this email! Your gift card code is required to use your gift card. This gift card expires in one year from the purchase date.

Thank you for choosing JumpCSRA!

JumpCSRA Party Rentals
Phone: (803) 221-0466
  `.trim();
};

// Cloud Function to send gift card email
export const sendGiftCardEmail = functions.https.onCall(async (data: GiftCardEmailData, context) => {
  // Verify that the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send gift card emails.');
  }

  try {
    // Validate input data
    if (!data.recipientEmail || !data.giftCardCode || !data.giftCardBalance) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required email data.');
    }

    if (!sendGridApiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
    }

    const msg = {
      to: data.recipientEmail,
      from: 'jumpcsra@gmail.com', // Simplified format
      subject: `Your JumpCSRA Gift Card - $${data.giftCardBalance.toFixed(2)}`,
      html: generateGiftCardEmailHTML(data),
      text: generateGiftCardEmailText(data),
      // Optional: Add categories for tracking
      categories: ['gift-card', 'transactional'],
      // Optional: Add custom args for tracking
      customArgs: {
        giftCardCode: data.giftCardCode,
        amount: data.giftCardBalance.toString()
      }
    };

    await sgMail.send(msg);
    
    // Log successful email send
    console.log(`Gift card email sent successfully to ${data.recipientEmail} for code ${data.giftCardCode}`);
    
    return { 
      success: true, 
      message: 'Gift card email sent successfully',
      emailSent: true
    };

  } catch (error) {
    console.error('Error sending gift card email:', error);
    
    // If it's a SendGrid error, provide more specific information
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('SendGrid error response:', (error as any).response?.body);
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to send gift card email.');
  }
});

// Alternative: Cloud Function triggered by Firestore document creation
export const sendGiftCardEmailOnCreate = functions.firestore
  .document('giftCards/{giftCardId}')
  .onCreate(async (snap: any, context: any) => {
    const giftCard = snap.data();
    
    // Only send email for purchased gift cards (not promotional ones)
    if (!giftCard.isGift && giftCard.purchaserEmail) {
      try {
        const emailData: GiftCardEmailData = {
          recipientEmail: giftCard.purchaserEmail,
          recipientName: giftCard.purchaserName || 'Customer',
          giftCardCode: giftCard.redemptionCode,
          giftCardBalance: giftCard.originalAmount,
          expirationDate: giftCard.expirationDate,
          purchaseDate: giftCard.purchaseDate
        };

        if (!sendGridApiKey) {
          console.error('SendGrid API key not configured');
          return;
        }

        const msg = {
          to: emailData.recipientEmail,
          from: {
            email: 'jumpcsra@gmail.com', // Using your Gmail address
            name: 'JumpCSRA Party Rentals'
          },
          subject: `Your JumpCSRA Gift Card - $${emailData.giftCardBalance.toFixed(2)}`,
          html: generateGiftCardEmailHTML(emailData),
          text: generateGiftCardEmailText(emailData),
          categories: ['gift-card', 'transactional'],
          customArgs: {
            giftCardCode: emailData.giftCardCode,
            amount: emailData.giftCardBalance.toString()
          }
        };

        await sgMail.send(msg);
        console.log(`Auto-sent gift card email to ${emailData.recipientEmail} for code ${emailData.giftCardCode}`);
        
      } catch (error) {
        console.error('Error auto-sending gift card email:', error);
      }
    }
  });

// Cloud Function to send order confirmation email
// Enhanced SendGrid Email System - Replace PayPal Invoicing
export const sendEnhancedOrderConfirmation = functions.https.onCall(async (data: OrderConfirmationEmailData, context) => {
  try {
    // SendGrid API key validation
    if (!sendGridApiKey) {
      console.error('❌ ENHANCED EMAIL - SendGrid API key not configured');
      throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
    }

    console.log('📧 ENHANCED EMAIL - Sending comprehensive order confirmation to:', data.recipientEmail, 'for order:', data.orderID);
    console.log('📧 ENHANCED EMAIL - Using sender email:', 'jumpcsra@gmail.com');
    console.log('📧 ENHANCED EMAIL - SendGrid API Key configured:', !!sendGridApiKey);

    // Try alternative SendGrid sender format
    const msg = {
      to: data.recipientEmail,
      from: {
        email: 'jumpcsra@gmail.com',
        name: 'JumpCSRA Party Rentals'
      },
      subject: `Order Confirmation & Invoice #${data.orderID} - JumpCSRA Party Rentals`,
      html: generateEnhancedOrderEmailHTML(data),
      // Optional: Add categories for tracking
      categories: ['order-confirmation', 'invoice', 'transactional'],
      // Optional: Add custom args for tracking
      customArgs: {
        orderID: data.orderID,
        totalAmount: data.totalAmount.toString(),
        bookingStatus: data.bookingStatus,
        hasGiftCards: (data.giftCards?.length || 0).toString()
      }
    };

    console.log('📧 ENHANCED EMAIL - About to send email via SendGrid...');
    console.log('📧 ENHANCED EMAIL - Message config:', JSON.stringify({
      to: msg.to,
      from: msg.from,
      subject: msg.subject,
      hasHtml: !!msg.html,
      categories: msg.categories
    }, null, 2));
    
    try {
      const sendResult = await sgMail.send(msg);
      console.log('📧 ENHANCED EMAIL - SendGrid success response:', JSON.stringify(sendResult, null, 2));
    } catch (sgError: any) {
      console.error('📧 ENHANCED EMAIL - SendGrid detailed error:', JSON.stringify(sgError, null, 2));
      if (sgError.response && sgError.response.body && sgError.response.body.errors) {
        console.error('📧 ENHANCED EMAIL - SendGrid specific errors:', sgError.response.body.errors);
      }
      
      // Fallback: Return success but indicate email failed
      console.log('📧 ENHANCED EMAIL - Returning success despite email failure for system stability');
      return { 
        success: true, 
        message: 'Order processed successfully (email delivery pending)',
        emailSent: false,
        fallbackRequired: true
      };
    }
    
    // Log successful email send
    console.log(`Enhanced order confirmation & invoice email sent successfully to ${data.recipientEmail} for order ${data.orderID}`);
    
    return { 
      success: true, 
      message: 'Order confirmation & invoice email sent successfully',
      emailSent: true
    };

  } catch (error) {
    console.error('Error sending enhanced order confirmation email:', error);
    console.error('📧 ENHANCED EMAIL - Full error details:', JSON.stringify(error, null, 2));
    
    // If it's a SendGrid error, provide more specific information
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('SendGrid error response:', (error as any).response?.body);
    }
    
    // Always return success to prevent checkout failures
    return { 
      success: true, 
      message: 'Order processed successfully (email delivery pending)',
      emailSent: false,
      fallbackRequired: true
    };
  }
});

// Legacy order confirmation email function (keep for compatibility)
export const sendOrderConfirmationEmail = functions.https.onCall(async (data: OrderConfirmationEmailData, context) => {
  console.log('📧 ORDER EMAIL - Function called, auth status:', !!context.auth);
  
  try {
    // For order confirmations, we'll be more lenient about authentication
    // since these are triggered by completed payments
    if (!context.auth) {
      console.log('⚠️ ORDER EMAIL - No authentication provided, but proceeding for order confirmation');
    }

    // Validate input data
    if (!data.recipientEmail || !data.orderID || typeof data.totalAmount !== 'number') {
      console.error('❌ ORDER EMAIL - Invalid input data:', {
        hasEmail: !!data.recipientEmail,
        hasOrderID: !!data.orderID,
        totalAmountType: typeof data.totalAmount
      });
      throw new functions.https.HttpsError('invalid-argument', 'Missing required email data.');
    }

    if (!sendGridApiKey) {
      console.error('❌ ORDER EMAIL - SendGrid API key not configured');
      throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
    }

    console.log('📧 ORDER EMAIL - Sending to:', data.recipientEmail, 'for order:', data.orderID);
    console.log('📧 ORDER EMAIL - Using sender email:', 'jumpcsra@gmail.com');
    console.log('📧 ORDER EMAIL - SendGrid API Key configured:', !!sendGridApiKey);

    // Try alternative SendGrid sender format
    const msg = {
      to: data.recipientEmail,
      from: {
        email: 'jumpcsra@gmail.com',
        name: 'JumpCSRA'
      },
      subject: `Order Confirmation #${data.orderID} - JumpCSRA Party Rentals`,
      html: generateOrderConfirmationEmailHTML(data),
      // Optional: Add categories for tracking
      categories: ['order-confirmation', 'transactional'],
      // Optional: Add custom args for tracking
      customArgs: {
        orderID: data.orderID,
        totalAmount: data.totalAmount.toString(),
        bookingStatus: data.bookingStatus
      }
    };

    console.log('📧 ORDER EMAIL - About to send email via SendGrid...');
    console.log('📧 ORDER EMAIL - Message config:', JSON.stringify({
      to: msg.to,
      from: msg.from,
      subject: msg.subject,
      hasHtml: !!msg.html,
      categories: msg.categories
    }, null, 2));
    
    try {
      const sendResult = await sgMail.send(msg);
      console.log('📧 ORDER EMAIL - SendGrid success response:', JSON.stringify(sendResult, null, 2));
    } catch (sgError: any) {
      console.error('📧 ORDER EMAIL - SendGrid detailed error:', JSON.stringify(sgError, null, 2));
      if (sgError.response && sgError.response.body && sgError.response.body.errors) {
        console.error('📧 ORDER EMAIL - SendGrid specific errors:', sgError.response.body.errors);
      }
      
      // Fallback: Return success but indicate email failed
      console.log('📧 ORDER EMAIL - Returning success despite email failure for system stability');
      return { 
        success: true, 
        message: 'Order processed successfully (email delivery pending)',
        emailSent: false,
        fallbackRequired: true
      };
    }
    
    // Log successful email send
    console.log(`Order confirmation email sent successfully to ${data.recipientEmail} for order ${data.orderID}`);
    
    return { 
      success: true, 
      message: 'Order confirmation email sent successfully',
      emailSent: true
    };

  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    console.error('📧 ORDER EMAIL - Full error details:', JSON.stringify(error, null, 2));
    
    // If it's a SendGrid error, provide more specific information
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('SendGrid error response:', (error as any).response?.body);
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to send order confirmation email.');
  }
});

// PayPal Invoice interfaces
interface PayPalInvoiceData {
  recipientEmail: string;
  recipientName: string;
  orderID: string;
  orderDate: string;
  eventDate?: string;
  deliveryAddress?: string;
  deliveryTime?: string;
  duration?: string;
  surface?: string;
  rentalItems: Array<{
    name: string;
    quantity: number;
    price: number;
    duration?: string;
    wetDry?: string;
  }>;
  lastMinuteAdditions: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  surfaceAdjustment: number;
  timeAdjustment: number;
  deliveryCost: number;
  totalAmount: number;
  paymentType: 'full' | 'deposit';
  amountPaid: number;
  remainingBalance: number;
  paymentMethod: string;
  giftCards: Array<{
    code: string;
    balance: number;
    expirationDate: string;
    isPromotional?: boolean;
    promotionalMessage?: string;
    recipientEmail?: string;
  }>;
  bookingStatus: string;
  requiresPhoneCall?: boolean;
  paypalOrderId?: string;
  paypalTransactionId?: string;
}

// Get PayPal access token
const getPayPalAccessToken = async (): Promise<string> => {
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
      throw new Error(`PayPal auth failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting PayPal access token:', error);
    throw error;
  }
};

// Convert order data to PayPal invoice format
const createPayPalInvoicePayload = (data: PayPalInvoiceData) => {
  const items: any[] = [];
  
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
  
  // Add adjustments
  if (data.surfaceAdjustment > 0) {
    items.push({
      name: "Surface Adjustment",
      description: "Additional charge for surface preparation",
      quantity: "1",
      unit_amount: {
        currency_code: "USD",
        value: data.surfaceAdjustment.toFixed(2)
      }
    });
  }
  
  if (data.timeAdjustment > 0) {
    items.push({
      name: "Time Adjustment",
      description: "Additional charge for timing requirements",
      quantity: "1",
      unit_amount: {
        currency_code: "USD",
        value: data.timeAdjustment.toFixed(2)
      }
    });
  }
  
  if (data.deliveryCost > 0) {
    items.push({
      name: "Delivery Service",
      description: "Delivery and setup service",
      quantity: "1",
      unit_amount: {
        currency_code: "USD",
        value: data.deliveryCost.toFixed(2)
      }
    });
  }
  
  // Generate invoice note with gift card info
  let note = `Order Confirmation for ${data.recipientName}\n\n`;
  
  if (data.eventDate) {
    note += `Event Details:\n`;
    note += `• Date: ${data.eventDate}\n`;
    if (data.deliveryAddress) note += `• Address: ${data.deliveryAddress}\n`;
    if (data.deliveryTime) note += `• Delivery Time: ${data.deliveryTime}\n`;
    if (data.duration) note += `• Duration: ${data.duration}\n`;
    if (data.surface) note += `• Surface: ${data.surface}\n`;
    note += `\n`;
  }
  
  note += `Payment Information:\n`;
  note += `• Payment Type: ${data.paymentType === 'deposit' ? '50% Deposit' : 'Full Payment'}\n`;
  note += `• Amount Paid: $${data.amountPaid.toFixed(2)} (${data.paymentMethod})\n`;
  if (data.remainingBalance > 0) {
    note += `• Remaining Balance: $${data.remainingBalance.toFixed(2)} (due before event)\n`;
  }
  note += `\n`;
  
  if (data.giftCards.length > 0) {
    note += `Gift Cards Included:\n`;
    data.giftCards.forEach(gc => {
      note += `• Code: ${gc.code} - $${gc.balance.toFixed(2)}\n`;
      note += `  Expires: ${gc.expirationDate}\n`;
      if (gc.isPromotional) {
        note += `  Type: Promotional Gift Card\n`;
        if (gc.promotionalMessage) {
          note += `  Note: ${gc.promotionalMessage}\n`;
        }
        if (gc.recipientEmail && gc.recipientEmail !== data.recipientEmail) {
          note += `  Recipient: ${gc.recipientEmail}\n`;
        }
      }
      note += `\n`;
    });
    
    note += `Gift Card Usage:\n`;
    note += `• Log in to your account at jumpcsra.com\n`;
    note += `• Use the gift card balance checker in your profile\n`;
    note += `• Apply gift card balance during checkout\n`;
    note += `• Gift cards never expire and can be used for any rental\n\n`;
  }
  
  // Add status information
  switch (data.bookingStatus.toLowerCase()) {
    case 'confirmed':
      note += `Status: ✅ Order Confirmed - Your booking is confirmed and ready!\n`;
      break;
    case 'pending':
      note += `Status: ⏳ Order Pending - We're processing your order and will confirm shortly.\n`;
      break;
    case 'deferred':
      note += `Status: 📞 Call Required - Since your event is within 2 days, we'll contact you to confirm details.\n`;
      break;
    default:
      note += `Status: 📋 Order Received - Thank you for your order!\n`;
  }
  
  if (data.requiresPhoneCall) {
    note += `Important: We'll contact you to confirm details and arrange delivery.\n`;
  }
  
  note += `\nQuestions? Contact us at jumpcsra@gmail.com or visit jumpcsra.com\n`;
  note += `Thank you for choosing JumpCSRA Party Rentals!`;
  
  return {
    detail: {
      invoice_number: `JC-${data.orderID.slice(-10)}`, // Take last 10 chars to keep under 25 char limit
      reference: data.paypalOrderId || data.orderID,
      invoice_date: new Date(data.orderDate).toISOString().split('T')[0],
      currency_code: "USD",
      note: note,
      term: "No refunds after event date",
      memo: `JumpCSRA Order #${data.orderID}`,
      payment_term: {
        term_type: "NET_10",
        due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    },
    invoicer: {
      name: {
        given_name: "JumpCSRA",
        surname: "Party Rentals"
      },
      address: {
        address_line_1: "Your Business Address",
        admin_area_2: "Your City", 
        admin_area_1: "SC",
        postal_code: "Your ZIP",
        country_code: "US"
      },
      email_address: "jumpcsra@gmail.com",
      phones: [
        {
          country_code: "001",
          national_number: "8032210466",
          phone_type: "MOBILE"
        }
      ],
      website: "https://jumpcsra.com",
      additional_notes: "Making Your Events Unforgettable"
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: data.recipientName.split(' ')[0] || data.recipientName,
            surname: data.recipientName.split(' ').slice(1).join(' ') || ""
          },
          address: data.deliveryAddress ? {
            address_line_1: data.deliveryAddress,
            country_code: "US"
          } : undefined,
          email_address: data.recipientEmail
        }
      }
    ],
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

// Cloud Function to create and send PayPal invoice
export const createPayPalInvoice = functions.https.onCall(async (data: PayPalInvoiceData, context) => {
  console.log('🚀 FIREBASE FUNCTION - createPayPalInvoice called, auth status:', !!context.auth);
  
  try {
    // For PayPal invoices triggered by completed payments, be more lenient about authentication
    if (!context.auth) {
      console.log('⚠️ PAYPAL INVOICE - No authentication provided, but proceeding for completed payment');
    }

    console.log('📧 Input data validation:', {
      orderID: data.orderID,
      recipientEmail: data.recipientEmail,
      totalAmount: data.totalAmount,
      giftCardsCount: data.giftCards?.length || 0
    });

    // Validate input data
    if (!data.recipientEmail || !data.orderID || typeof data.totalAmount !== 'number') {
      console.error('❌ FIREBASE FUNCTION - Invalid input data:', {
        hasEmail: !!data.recipientEmail,
        hasOrderID: !!data.orderID,
        totalAmountType: typeof data.totalAmount
      });
      throw new functions.https.HttpsError('invalid-argument', 'Missing required invoice data.');
    }

    console.log(`📧 FIREBASE FUNCTION - Creating PayPal invoice for order ${data.orderID}`);
    
    // Get PayPal access token
    console.log('🔑 FIREBASE FUNCTION - Getting PayPal access token...');
    const accessToken = await getPayPalAccessToken();
    console.log('✅ FIREBASE FUNCTION - Access token obtained');
    
    // Create invoice payload
    console.log('📋 FIREBASE FUNCTION - Creating invoice payload...');
    const invoicePayload = createPayPalInvoicePayload(data);
    console.log('✅ FIREBASE FUNCTION - Invoice payload created');
    
    // Create the invoice
    console.log('📤 FIREBASE FUNCTION - Creating invoice via PayPal API...');
    
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
      const errorText = await createResponse.text();
      console.error('❌ FIREBASE FUNCTION - PayPal create invoice error:', errorText);
      throw new functions.https.HttpsError('internal', `PayPal API error: ${createResponse.status}`);
    }
    
    console.log('📋 FIREBASE FUNCTION - PayPal response status:', createResponse.status);
    console.log('📋 FIREBASE FUNCTION - PayPal response headers:', createResponse.headers);
    
    const invoice = await createResponse.json();
    
    
    console.log('✅ FIREBASE FUNCTION - Invoice created with ID:', invoice.id);
    
    // Check if invoice ID exists
    if (!invoice.id) {
      console.error('❌ FIREBASE FUNCTION - No invoice ID in response:', invoice);
      
      // Fallback: Return success but indicate invoice creation failed
      console.log('💰 FIREBASE FUNCTION - Returning success despite invoice failure for system stability');
      return { 
        success: true, 
        message: 'Order processed successfully (invoice delivery pending)',
        invoiceCreated: false,
        fallbackRequired: true
      };
    }
    
    // Send the invoice
    console.log('📮 FIREBASE FUNCTION - Sending invoice to customer...');
    const sendResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices/${invoice.id}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        send_to_recipient: true,
        send_to_invoicer: true
      })
    });
    
    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error('❌ FIREBASE FUNCTION - PayPal send invoice error:', errorText);
      throw new functions.https.HttpsError('internal', `Failed to send invoice: ${sendResponse.status}`);
    }
    
    console.log(`✅ FIREBASE FUNCTION - PayPal invoice created and sent successfully: ${invoice.id}`);
    
    return {
      success: true,
      invoiceId: invoice.id,
      invoiceUrl: invoice.href || `https://paypal.com/invoice/details/${invoice.id}`,
      message: 'PayPal invoice created and sent successfully'
    };

  } catch (error) {
    console.error('❌ FIREBASE FUNCTION - Error creating PayPal invoice:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to create PayPal invoice.');
  }
});

// ============================================================================
// SCHEDULED EMAIL FUNCTIONS - Individual email sending functions
// ============================================================================

// Cart abandonment email
async function sendCartAbandonmentEmail(cart: any, userId: string) {
  try {
    console.log('📧 Sending cart abandonment email to:', cart.customerEmail);
    
    const emailHTML = generateCartAbandonmentEmailHTML(cart, userId);
    
    const msg = {
      to: cart.customerEmail,
      from: 'jumpcsra@gmail.com',
      subject: 'Don\'t forget your bounce house rental! 🏰',
      html: emailHTML,
      categories: ['cart-abandonment', 'marketing']
    };

    await sgMail.send(msg);
    console.log('✅ Cart abandonment email sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending cart abandonment email:', error);
    throw error;
  }
}

// Deposit reminder email
async function sendDepositReminderEmail(booking: any, bookingId: string) {
  try {
    console.log('📧 Sending deposit reminder email to:', booking.customerEmail);
    
    const emailHTML = generateDepositReminderEmailHTML(booking, bookingId);
    
    const msg = {
      to: booking.customerEmail,
      from: 'jumpcsra@gmail.com',
      subject: `Final Payment Due Soon - Event ${booking.eventDate} 💰`,
      html: emailHTML,
      categories: ['deposit-reminder', 'transactional']
    };

    await sgMail.send(msg);
    console.log('✅ Deposit reminder email sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending deposit reminder email:', error);
    throw error;
  }
}

// Event confirmation email
async function sendEventConfirmationEmail(booking: any, bookingId: string) {
  try {
    console.log('📧 Sending event confirmation email to:', booking.customerEmail);
    
    const emailHTML = generateEventConfirmationEmailHTML(booking, bookingId);
    
    const msg = {
      to: booking.customerEmail,
      from: 'jumpcsra@gmail.com',
      subject: `Your Event is Coming Up! - ${booking.eventDate} 🎉`,
      html: emailHTML,
      categories: ['event-confirmation', 'transactional']
    };

    await sgMail.send(msg);
    console.log('✅ Event confirmation email sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending event confirmation email:', error);
    throw error;
  }
}

// Post-event thank you email
async function sendPostEventThanksEmail(booking: any, bookingId: string) {
  try {
    console.log('📧 Sending post-event thank you email to:', booking.customerEmail);
    
    const emailHTML = generatePostEventThanksEmailHTML(booking, bookingId);
    
    const msg = {
      to: booking.customerEmail,
      from: 'jumpcsra@gmail.com',
      subject: `Thank you for choosing JumpCSRA! 🙏`,
      html: emailHTML,
      categories: ['post-event', 'marketing']
    };

    await sgMail.send(msg);
    console.log('✅ Post-event thank you email sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending post-event thank you email:', error);
    throw error;
  }
}

// Rebooking reminder email
async function sendRebookingReminderEmail(booking: any, bookingId: string) {
  try {
    console.log('📧 Sending rebooking reminder email to:', booking.customerEmail);
    
    const emailHTML = generateRebookingReminderEmailHTML(booking, bookingId);
    
    const msg = {
      to: booking.customerEmail,
      from: 'jumpcsra@gmail.com',
      subject: `Time for Another Party? 🎈 Special Returning Customer Discount!`,
      html: emailHTML,
      categories: ['rebooking-reminder', 'marketing']
    };

    await sgMail.send(msg);
    console.log('✅ Rebooking reminder email sent successfully');
    
  } catch (error) {
    console.error('❌ Error sending rebooking reminder email:', error);
    throw error;
  }
}

// ============================================================================
// EMAIL TEMPLATE GENERATORS - HTML templates for scheduled emails
// ============================================================================

// Cart abandonment email template
function generateCartAbandonmentEmailHTML(cart: any, userId: string): string {
  const cartItems = cart.cartItems || [];
  const cartTotal = cart.cartValue || 0;
  
  const itemsHTML = cartItems.map((item: any) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <strong>${item.name || item.title}</strong><br>
        <small style="color: #666;">${item.category || 'Rental Item'}</small>
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
        $${(item.price || 0).toFixed(2)}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Don't Forget Your Bounce House Rental!</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { text-align: center; color: #2c5aa0; margin-bottom: 30px; }
        .cta-button { display: inline-block; background: #ff6b35; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏰 Don't Forget Your Bounce House Rental!</h1>
        </div>
        
        <p>Hi ${cart.customerName || 'there'}!</p>
        
        <p>We noticed you left some amazing bounce houses in your cart. Don't let the fun slip away! Your party rentals are waiting for you:</p>
        
        <table>
          <thead>
            <tr style="background-color: #f8f9fa;">
              <th style="padding: 15px; text-align: left;">Item</th>
              <th style="padding: 15px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
          <tfoot>
            <tr style="background-color: #2c5aa0; color: white;">
              <th style="padding: 15px; text-align: left;">Total</th>
              <th style="padding: 15px; text-align: right;">$${cartTotal.toFixed(2)}</th>
            </tr>
          </tfoot>
        </table>
        
        <div style="text-align: center;">
          <a href="https://jumpcsra.com/checkout" class="cta-button">Complete Your Booking Now! 🎉</a>
        </div>
        
        <p>❗ <strong>Important:</strong> Popular items book up fast, especially on weekends. Complete your booking now to secure your date!</p>
        
        <p>Questions? Reply to this email or call us at (555) 123-4567.</p>
        
        <div class="footer">
          <p>JumpCSRA Party Rentals - Making Your Celebrations Unforgettable!</p>
          <p>If you no longer wish to receive these emails, <a href="#">unsubscribe here</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Deposit reminder email template
function generateDepositReminderEmailHTML(booking: any, bookingId: string): string {
  const eventDate = new Date(booking.eventDate).toLocaleDateString();
  const remainingAmount = booking.remainingBalance || 0;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Final Payment Due Soon</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { text-align: center; color: #2c5aa0; margin-bottom: 30px; }
        .alert { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .cta-button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💰 Final Payment Reminder</h1>
        </div>
        
        <p>Hi ${booking.customerName || 'there'}!</p>
        
        <p>Your bounce house party is coming up soon! Just a friendly reminder that your final payment is due.</p>
        
        <div class="alert">
          <strong>Event Details:</strong><br>
          📅 <strong>Date:</strong> ${eventDate}<br>
          💵 <strong>Remaining Balance:</strong> $${remainingAmount.toFixed(2)}<br>
          🆔 <strong>Booking ID:</strong> ${bookingId}
        </div>
        
        <p>To ensure your event goes smoothly, please complete your final payment as soon as possible. You can pay online through your customer portal or call us directly.</p>
        
        <div style="text-align: center;">
          <a href="https://jumpcsra.com/profile" class="cta-button">Pay Remaining Balance 💳</a>
        </div>
        
        <p><strong>Payment Options:</strong></p>
        <ul>
          <li>💻 Online: Log into your account at jumpcsra.com</li>
          <li>📞 Phone: Call us at (555) 123-4567</li>
          <li>💵 Cash: Pay on delivery (arrangement required)</li>
        </ul>
        
        <p>Thank you for choosing JumpCSRA for your celebration!</p>
        
        <div class="footer">
          <p>JumpCSRA Party Rentals - Making Your Celebrations Unforgettable!</p>
          <p>Questions? Reply to this email or call (555) 123-4567</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Event confirmation email template
function generateEventConfirmationEmailHTML(booking: any, bookingId: string): string {
  const eventDate = new Date(booking.eventDate).toLocaleDateString();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your Event is Coming Up!</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { text-align: center; color: #2c5aa0; margin-bottom: 30px; }
        .info-box { background: #e3f2fd; border: 1px solid #2196f3; color: #1565c0; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .checklist { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Your Event is Almost Here!</h1>
        </div>
        
        <p>Hi ${booking.customerName || 'there'}!</p>
        
        <p>We're excited that your bounce house party is coming up in just a few days! Here's everything you need to know:</p>
        
        <div class="info-box">
          <strong>Event Details:</strong><br>
          📅 <strong>Date:</strong> ${eventDate}<br>
          📍 <strong>Address:</strong> ${booking.deliveryAddress || 'As provided'}<br>
          🕐 <strong>Setup Time:</strong> ${booking.deliveryTime || 'As scheduled'}<br>
          🆔 <strong>Booking ID:</strong> ${bookingId}
        </div>
        
        <div class="checklist">
          <h3>📋 Pre-Event Checklist:</h3>
          <ul>
            <li>✅ Ensure the setup area is clear and accessible</li>
            <li>✅ Have electrical outlets within 100 feet available</li>
            <li>✅ Check weather forecast (we'll contact you if needed)</li>
            <li>✅ Prepare space for our delivery team</li>
            <li>✅ Have someone available during delivery window</li>
          </ul>
        </div>
        
        <p><strong>Delivery Information:</strong></p>
        <ul>
          <li>🚚 Our team will arrive during your scheduled time window</li>
          <li>⚡ We'll need access to electricity for setup</li>
          <li>🏠 Please ensure the setup area is easily accessible</li>
          <li>📱 We'll call 30 minutes before arrival</li>
        </ul>
        
        <p><strong>Weather Policy:</strong> We monitor weather conditions closely. If severe weather is expected, we'll contact you to discuss rescheduling options.</p>
        
        <p>Need to make any changes or have questions? Contact us immediately at (555) 123-4567.</p>
        
        <p>We can't wait to help make your celebration amazing! 🎈</p>
        
        <div class="footer">
          <p>JumpCSRA Party Rentals - Making Your Celebrations Unforgettable!</p>
          <p>Questions? Reply to this email or call (555) 123-4567</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Post-event thank you email template
function generatePostEventThanksEmailHTML(booking: any, bookingId: string): string {
  const eventDate = new Date(booking.eventDate).toLocaleDateString();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Thank You for Choosing JumpCSRA!</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { text-align: center; color: #2c5aa0; margin-bottom: 30px; }
        .highlight { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
        .cta-button { display: inline-block; background: #ff6b35; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🙏 Thank You for Choosing JumpCSRA!</h1>
        </div>
        
        <p>Hi ${booking.customerName || 'there'}!</p>
        
        <p>We hope your event on ${eventDate} was absolutely amazing! It was our pleasure to help make your celebration special with our bounce house rentals.</p>
        
        <div class="highlight">
          <h3>🌟 How did we do?</h3>
          <p>Your feedback means the world to us! Please take a moment to share your experience.</p>
        </div>
        
        <div style="text-align: center;">
          <a href="https://g.page/r/YOUR_GOOGLE_REVIEW_LINK/review" class="cta-button">Leave a Google Review ⭐</a>
        </div>
        
        <p><strong>Share Your Photos! 📸</strong><br>
        We'd love to see photos from your event! Tag us on social media @JumpCSRA or email them to us. We might feature your celebration (with permission) on our website!</p>
        
        <p><strong>Planning Another Event?</strong><br>
        As a returning customer, you'll receive exclusive discounts and early access to new equipment. Keep us in mind for:</p>
        <ul>
          <li>🎂 Birthday parties</li>
          <li>🎓 Graduation celebrations</li>
          <li>🏫 School events</li>
          <li>🏢 Corporate gatherings</li>
          <li>🎪 Community festivals</li>
        </ul>
        
        <p><strong>Refer a Friend:</strong> Know someone planning a party? Refer them to JumpCSRA and you'll both receive a special discount on your next rental!</p>
        
        <p>Thank you again for trusting us with your special day. We hope to bounce with you again soon! 🎈</p>
        
        <div class="footer">
          <p>JumpCSRA Party Rentals - Making Your Celebrations Unforgettable!</p>
          <p>Follow us: Facebook | Instagram | Twitter</p>
          <p>Questions? Reply to this email or call (555) 123-4567</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Rebooking reminder email template
function generateRebookingReminderEmailHTML(booking: any, bookingId: string): string {
  const lastEventDate = new Date(booking.eventDate).toLocaleDateString();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Time for Another Party?</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .header { text-align: center; color: #2c5aa0; margin-bottom: 30px; }
        .discount-box { background: linear-gradient(135deg, #ff6b35, #f39c12); color: white; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .cta-button { display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .features { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎈 Time for Another Amazing Party?</h1>
        </div>
        
        <p>Hi ${booking.customerName || 'there'}!</p>
        
        <p>It's been a while since your last bounce house party with us on ${lastEventDate}, and we've been thinking about you! Are you ready to create more unforgettable memories?</p>
        
        <div class="discount-box">
          <h2>🎉 SPECIAL RETURNING CUSTOMER OFFER!</h2>
          <h3 style="margin: 10px 0; font-size: 28px;">15% OFF</h3>
          <p style="margin: 5px 0;">Your Next Rental + FREE Setup</p>
          <p style="font-size: 14px; margin: 5px 0;">Use Code: WELCOME-BACK</p>
        </div>
        
        <div style="text-align: center;">
          <a href="https://jumpcsra.com?discount=WELCOME-BACK" class="cta-button">Browse Bounce Houses 🏰</a>
        </div>
        
        <div class="features">
          <h3>🆕 What's New Since Your Last Visit:</h3>
          <ul>
            <li>🎪 Brand new themed bounce houses (Princess, Superhero, Sports)</li>
            <li>🌊 Water slide combos for summer fun</li>
            <li>🎯 Interactive games and obstacle courses</li>
            <li>📱 Improved online booking with instant confirmation</li>
            <li>🚚 Extended delivery areas</li>
          </ul>
        </div>
        
        <p><strong>Perfect for:</strong></p>
        <ul>
          <li>🎂 Upcoming birthdays</li>
          <li>🎓 Graduation celebrations</li>
          <li>☀️ Summer parties</li>
          <li>🏫 School events</li>
          <li>👨‍👩‍👧‍👦 Family reunions</li>
        </ul>
        
        <p><strong>Why Choose JumpCSRA Again?</strong></p>
        <ul>
          <li>✅ Same great service you remember</li>
          <li>✅ Clean, sanitized equipment</li>
          <li>✅ Professional setup and pickup</li>
          <li>✅ Competitive pricing</li>
          <li>✅ Last-minute availability</li>
        </ul>
        
        <p><strong>⏰ Limited Time Offer:</strong> This 15% discount expires in 30 days, so book soon to secure your date and savings!</p>
        
        <p>Ready to bounce back into fun? We can't wait to help make your next celebration spectacular! 🎉</p>
        
        <div class="footer">
          <p>JumpCSRA Party Rentals - Making Your Celebrations Unforgettable!</p>
          <p>Questions? Reply to this email or call (555) 123-4567</p>
          <p>If you no longer wish to receive these emails, <a href="#">unsubscribe here</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================================
// MANUAL EMAIL TESTING FUNCTIONS - For immediate testing via frontend
// ============================================================================

// Manual email testing function (callable from frontend)
export const triggerTestEmail = functions.https.onCall(async (data: { 
  emailType: string, 
  bookingId?: string, 
  userId?: string 
}, context: any) => {
  console.log('🧪 MANUAL TEST: Triggering test email:', data);
  
  try {
    const db = admin.database();
    
    switch (data.emailType) {
      case 'cart-abandonment':
        if (!data.userId) throw new Error('userId required for cart abandonment email');
        const cartRef = db.ref(`carts/${data.userId}`);
        const cartSnapshot = await cartRef.once('value');
        if (cartSnapshot.exists()) {
          await sendCartAbandonmentEmail(cartSnapshot.val(), data.userId);
          return { success: true, message: 'Cart abandonment email sent' };
        }
        throw new Error('Cart not found');
        
      case 'deposit-reminder':
        if (!data.bookingId) throw new Error('bookingId required for deposit reminder email');
        const bookingRef = db.ref(`bookings/${data.bookingId}`);
        const bookingSnapshot = await bookingRef.once('value');
        if (bookingSnapshot.exists()) {
          await sendDepositReminderEmail(bookingSnapshot.val(), data.bookingId);
          return { success: true, message: 'Deposit reminder email sent' };
        }
        throw new Error('Booking not found');
        
      case 'event-confirmation':
        if (!data.bookingId) throw new Error('bookingId required for event confirmation email');
        const eventBookingRef = db.ref(`bookings/${data.bookingId}`);
        const eventBookingSnapshot = await eventBookingRef.once('value');
        if (eventBookingSnapshot.exists()) {
          await sendEventConfirmationEmail(eventBookingSnapshot.val(), data.bookingId);
          return { success: true, message: 'Event confirmation email sent' };
        }
        throw new Error('Booking not found');
        
      case 'post-event-thanks':
        if (!data.bookingId) throw new Error('bookingId required for post-event email');
        const postEventBookingRef = db.ref(`bookings/${data.bookingId}`);
        const postEventBookingSnapshot = await postEventBookingRef.once('value');
        if (postEventBookingSnapshot.exists()) {
          await sendPostEventThanksEmail(postEventBookingSnapshot.val(), data.bookingId);
          return { success: true, message: 'Post-event thank you email sent' };
        }
        throw new Error('Booking not found');
        
      case 'rebooking-reminder':
        if (!data.bookingId) throw new Error('bookingId required for rebooking reminder email');
        const rebookingBookingRef = db.ref(`bookings/${data.bookingId}`);
        const rebookingBookingSnapshot = await rebookingBookingRef.once('value');
        if (rebookingBookingSnapshot.exists()) {
          await sendRebookingReminderEmail(rebookingBookingSnapshot.val(), data.bookingId);
          return { success: true, message: 'Rebooking reminder email sent' };
        }
        throw new Error('Booking not found');
        
      case 'process-all-scheduled':
        const now = Date.now();
        await processCartAbandonmentEmails(db, now);
        await processDepositReminderEmails(db, now);
        await processEventConfirmationEmails(db, now);
        await processPostEventEmails(db, now);
        await processRebookingReminderEmails(db, now);
        return { success: true, message: 'All scheduled emails processed' };
        
      default:
        throw new Error('Invalid email type. Use: cart-abandonment, deposit-reminder, event-confirmation, post-event-thanks, rebooking-reminder, or process-all-scheduled');
    }
    
  } catch (error) {
    console.error('❌ MANUAL TEST: Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage };
  }
});

// ============================================================================
// SCHEDULED EMAIL SYSTEM - Checks database daily for emails to send
// ============================================================================

// Environment variable for testing mode (speeds up email timing)
const emailConfig = functions.config().email || {};
const isTestingMode = emailConfig.testing_mode === 'true';

console.log(`📧 EMAIL SCHEDULER: Testing mode ${isTestingMode ? 'ENABLED' : 'DISABLED'}`);

// Email timing constants (in milliseconds)
const EMAIL_TIMING = {
  CART_ABANDONMENT: isTestingMode ? 1 * 60 * 1000 : 24 * 60 * 60 * 1000, // 1 min vs 24 hours
  DEPOSIT_REMINDER: isTestingMode ? 2 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000, // 2 min vs 7 days
  EVENT_CONFIRMATION: isTestingMode ? 3 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000, // 3 min vs 3 days
  POST_EVENT_THANKS: isTestingMode ? 4 * 60 * 1000 : 1 * 24 * 60 * 60 * 1000, // 4 min vs 1 day
  REBOOKING_REMINDER: isTestingMode ? 5 * 60 * 1000 : 9 * 30 * 24 * 60 * 60 * 1000 // 5 min vs 9 months
};

console.log('📧 EMAIL TIMING CONFIG:', {
  testingMode: isTestingMode,
  cartAbandonment: isTestingMode ? '1 minute' : '24 hours',
  depositReminder: isTestingMode ? '2 minutes' : '7 days',
  eventConfirmation: isTestingMode ? '3 minutes' : '3 days',
  postEventThanks: isTestingMode ? '4 minutes' : '1 day',
  rebookingReminder: isTestingMode ? '5 minutes' : '9 months'
});

// Main scheduled function to process all email types
export const processScheduledEmails = functions.pubsub
  .schedule(isTestingMode ? '*/2 * * * *' : '0 */6 * * *') // Every 2 minutes in testing, every 6 hours in production
  .timeZone('America/New_York') // EST/EDT timezone
  .onRun(async (context: any) => {
    console.log(`🕐 SCHEDULER: Running scheduled email processor... (Testing Mode: ${isTestingMode})`);
    
    try {
      const db = admin.database();
      const now = Date.now();
      
      // Process cart abandonment emails
      await processCartAbandonmentEmails(db, now);
      
      // Process deposit reminder emails
      await processDepositReminderEmails(db, now);
      
      // Process event confirmation emails
      await processEventConfirmationEmails(db, now);
      
      // Process post-event thank you emails
      await processPostEventEmails(db, now);
      
      // Process rebooking reminder emails
      await processRebookingReminderEmails(db, now);
      
      console.log('✅ SCHEDULER: All scheduled emails processed successfully');
      
    } catch (error) {
      console.error('❌ SCHEDULER: Error processing scheduled emails:', error);
      throw error;
    }
  });

// Helper function to process cart abandonment emails
async function processCartAbandonmentEmails(db: admin.database.Database, now: number) {
  try {
    console.log('📧 SCHEDULER: Checking cart abandonment emails...');
    
    const cartsRef = db.ref('carts');
    const snapshot = await cartsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('📧 SCHEDULER: No carts found');
      return;
    }
    
    const carts = snapshot.val();
    let emailsSent = 0;
    
    for (const [userId, cartData] of Object.entries(carts)) {
      const cart = cartData as any;
      
      // Skip if cart is empty or user already checked out
      if (!cart.cartItems || cart.cartItems.length === 0) continue;
      
      // Check if cart abandonment email should be sent
      const cartLastUpdated = cart.lastUpdated || cart.createdAt || now;
      const timeSinceUpdate = now - cartLastUpdated;
      
      if (timeSinceUpdate >= EMAIL_TIMING.CART_ABANDONMENT) {
        // Check if we already sent this email
        const emailSentKey = `cartAbandonment_${userId}_${cartLastUpdated}`;
        const emailRef = db.ref(`emailsSent/${emailSentKey}`);
        const emailSentSnapshot = await emailRef.once('value');
        
        if (!emailSentSnapshot.exists()) {
          await sendCartAbandonmentEmail(cart, userId);
          await emailRef.set({ sentAt: now, type: 'cart-abandonment' });
          emailsSent++;
        }
      }
    }
    
    console.log(`📧 SCHEDULER: Sent ${emailsSent} cart abandonment emails`);
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing cart abandonment emails:', error);
  }
}

// Helper function to process deposit reminder emails
async function processDepositReminderEmails(db: admin.database.Database, now: number) {
  try {
    console.log('📧 SCHEDULER: Checking deposit reminder emails...');
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('📧 SCHEDULER: No bookings found');
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process bookings with remaining balance (deposit payments)
      if (!booking.remainingBalance || booking.remainingBalance <= 0) continue;
      if (booking.status !== 'confirmed') continue;
      
      const eventDate = new Date(booking.eventDate).getTime();
      const timeUntilEvent = eventDate - now;
      
      // Send reminder 7 days before event (or testing interval)
      if (timeUntilEvent <= EMAIL_TIMING.DEPOSIT_REMINDER && timeUntilEvent > 0) {
        const emailSentKey = `depositReminder_${bookingId}`;
        const emailRef = db.ref(`emailsSent/${emailSentKey}`);
        const emailSentSnapshot = await emailRef.once('value');
        
        if (!emailSentSnapshot.exists()) {
          await sendDepositReminderEmail(booking, bookingId);
          await emailRef.set({ sentAt: now, type: 'deposit-reminder' });
          emailsSent++;
        }
      }
    }
    
    console.log(`📧 SCHEDULER: Sent ${emailsSent} deposit reminder emails`);
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing deposit reminder emails:', error);
  }
}

// Helper function to process event confirmation emails
async function processEventConfirmationEmails(db: admin.database.Database, now: number) {
  try {
    console.log('📧 SCHEDULER: Checking event confirmation emails...');
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('📧 SCHEDULER: No bookings found');
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process confirmed bookings
      if (booking.status !== 'confirmed') continue;
      
      const eventDate = new Date(booking.eventDate).getTime();
      const timeUntilEvent = eventDate - now;
      
      // Send confirmation 3 days before event
      if (timeUntilEvent <= EMAIL_TIMING.EVENT_CONFIRMATION && timeUntilEvent > 0) {
        const emailSentKey = `eventConfirmation_${bookingId}`;
        const emailRef = db.ref(`emailsSent/${emailSentKey}`);
        const emailSentSnapshot = await emailRef.once('value');
        
        if (!emailSentSnapshot.exists()) {
          await sendEventConfirmationEmail(booking, bookingId);
          await emailRef.set({ sentAt: now, type: 'event-confirmation' });
          emailsSent++;
        }
      }
    }
    
    console.log(`📧 SCHEDULER: Sent ${emailsSent} event confirmation emails`);
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing event confirmation emails:', error);
  }
}

// Helper function to process post-event thank you emails
async function processPostEventEmails(db: admin.database.Database, now: number) {
  try {
    console.log('📧 SCHEDULER: Checking post-event emails...');
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('📧 SCHEDULER: No bookings found');
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process completed events
      if (booking.status !== 'confirmed' && booking.status !== 'completed') continue;
      
      const eventDate = new Date(booking.eventDate).getTime();
      const timeSinceEvent = now - eventDate;
      
      // Send thank you 1 day after event
      if (timeSinceEvent >= EMAIL_TIMING.POST_EVENT_THANKS) {
        const emailSentKey = `postEventThanks_${bookingId}`;
        const emailRef = db.ref(`emailsSent/${emailSentKey}`);
        const emailSentSnapshot = await emailRef.once('value');
        
        if (!emailSentSnapshot.exists()) {
          await sendPostEventThanksEmail(booking, bookingId);
          await emailRef.set({ sentAt: now, type: 'post-event-thanks' });
          emailsSent++;
        }
      }
    }
    
    console.log(`📧 SCHEDULER: Sent ${emailsSent} post-event emails`);
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing post-event emails:', error);
  }
}

// Helper function to process rebooking reminder emails
async function processRebookingReminderEmails(db: admin.database.Database, now: number) {
  try {
    console.log('📧 SCHEDULER: Checking rebooking reminder emails...');
    
    const bookingsRef = db.ref('bookings');
    const snapshot = await bookingsRef.once('value');
    
    if (!snapshot.exists()) {
      console.log('📧 SCHEDULER: No bookings found');
      return;
    }
    
    const bookings = snapshot.val();
    let emailsSent = 0;
    
    for (const [bookingId, bookingData] of Object.entries(bookings)) {
      const booking = bookingData as any;
      
      // Only process completed events
      if (booking.status !== 'completed') continue;
      
      const eventDate = new Date(booking.eventDate).getTime();
      const timeSinceEvent = now - eventDate;
      
      // Send rebooking reminder 9 months after event
      if (timeSinceEvent >= EMAIL_TIMING.REBOOKING_REMINDER) {
        const emailSentKey = `rebookingReminder_${bookingId}`;
        const emailRef = db.ref(`emailsSent/${emailSentKey}`);
        const emailSentSnapshot = await emailRef.once('value');
        
        if (!emailSentSnapshot.exists()) {
          await sendRebookingReminderEmail(booking, bookingId);
          await emailRef.set({ sentAt: now, type: 'rebooking-reminder' });
          emailsSent++;
        }
      }
    }
    
    console.log(`📧 SCHEDULER: Sent ${emailsSent} rebooking reminder emails`);
    
  } catch (error) {
    console.error('❌ SCHEDULER: Error processing rebooking reminder emails:', error);
  }
}

// Scheduled function to auto-cancel pending orders on event day
export const autoCancelPendingOrders = functions.pubsub
  .schedule('0 8 * * *') // Run daily at 8 AM
  .timeZone('America/New_York') // EST/EDT timezone
  .onRun(async (context: any) => {
    console.log('Running auto-cancel pending orders function...');
    
    try {
      const db = admin.database();
      const bookingsRef = db.ref('bookings');
      const snapshot = await bookingsRef.once('value');
      
      if (!snapshot.exists()) {
        console.log('No bookings found');
        return null;
      }
      
      const bookings = snapshot.val();
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      
      let cancelledCount = 0;
      
      for (const [bookingId, booking] of Object.entries(bookings)) {
        const bookingData = booking as any;
        
        // Only process pending bookings
        if (bookingData.status !== 'pending') {
          continue;
        }
        
        // Check if event date is today or in the past
        const eventDateStr = bookingData.orderDetails?.eventDate;
        if (!eventDateStr) {
          continue;
        }
        
        // Parse event date (assuming format like "MM/DD/YYYY - MM/DD/YYYY")
        const dateRange = eventDateStr.split(' - ');
        const startDateStr = dateRange[0];
        
        try {
          const eventDate = new Date(startDateStr);
          eventDate.setHours(0, 0, 0, 0);
          
          // If event date is today or has passed, cancel the booking
          if (eventDate <= today) {
            console.log(`Cancelling booking ${bookingId} with event date ${startDateStr}`);
            
            // Update booking status to cancelled
            await bookingsRef.child(bookingId).update({
              status: 'cancelled',
              updatedAt: new Date().toISOString(),
              notes: admin.database.ServerValue.increment(1) // Will create array if doesn't exist
            });
            
            // Add cancellation note
            await bookingsRef.child(`${bookingId}/notes`).push({
              type: 'system',
              message: 'Booking auto-cancelled due to event date passing without payment completion',
              timestamp: new Date().toISOString()
            });
            
            // Send cancellation notification email
            try {
              if (bookingData.customerInfo?.email) {
                const msg = {
                  to: bookingData.customerInfo.email,
                  from: {
                    email: 'jumpcsra@gmail.com',
                    name: 'JumpCSRA Party Rentals'
                  },
                  subject: `Booking Cancelled - Order #${bookingData.orderID}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                      <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <h2>Booking Cancelled</h2>
                        <p>Your booking #${bookingData.orderID} has been automatically cancelled because the event date has passed without payment completion.</p>
                      </div>
                      
                      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                        <h3>Booking Details:</h3>
                        <p><strong>Order ID:</strong> ${bookingData.orderID}</p>
                        <p><strong>Event Date:</strong> ${eventDateStr}</p>
                        <p><strong>Total Amount:</strong> $${bookingData.orderDetails?.totalAmount?.toFixed(2) || '0.00'}</p>
                        <p><strong>Cancelled Date:</strong> ${new Date().toLocaleDateString()}</p>
                      </div>
                      
                      <div style="margin-top: 20px; padding: 15px; background: #d1ecf1; border-radius: 8px;">
                        <p><strong>Need to rebook?</strong> Visit <a href="https://jumpcsra.com">jumpcsra.com</a> to place a new order.</p>
                        <p>If you have questions, please contact us at jumpcsra@gmail.com or (803) 221-0466.</p>
                      </div>
                      
                      <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px;">
                        <p>JumpCSRA Party Rentals</p>
                        <p>Making Your Events Unforgettable</p>
                      </div>
                    </div>
                  `,
                  categories: ['booking-cancellation', 'automated'],
                  customArgs: {
                    bookingId: bookingId,
                    reason: 'auto-cancel-event-date-passed'
                  }
                };
                
                if (sendGridApiKey) {
                  await sgMail.send(msg);
                  console.log(`Cancellation email sent to ${bookingData.customerInfo.email} for booking ${bookingId}`);
                }
              }
            } catch (emailError) {
              console.error(`Error sending cancellation email for booking ${bookingId}:`, emailError);
            }
            
            cancelledCount++;
          }
        } catch (dateError) {
          console.error(`Error parsing event date for booking ${bookingId}:`, dateError);
        }
      }
      
      console.log(`Auto-cancellation complete. Cancelled ${cancelledCount} bookings.`);
      return null;
      
    } catch (error) {
      console.error('Error in auto-cancel function:', error);
      return null;
    }
  });

// Account deletion email function
export const sendAccountDeletionEmail = functions.https.onCall(async (data: {
  userEmail: string;
  userName: string;
  deletedWalletBalance: number;
  deletionDate: string;
}, context: any) => {
  // Verify that the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send account deletion emails.');
  }

  try {
    // Validate input data
    if (!data.userEmail || !data.userName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required email data.');
    }

    if (!sendGridApiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
    }

    const deletionDateFormatted = new Date(data.deletionDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const msg = {
      to: data.userEmail,
      from: 'jumpcsra@gmail.com', // Simplified format
      subject: 'Account Deletion Confirmation - JumpCSRA',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h2 style="margin: 0; color: #721c24;">Account Deletion Confirmed</h2>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Your JumpCSRA account has been permanently deleted</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0;">Deletion Summary</h3>
            <p><strong>Account Holder:</strong> ${data.userName}</p>
            <p><strong>Email:</strong> ${data.userEmail}</p>
            <p><strong>Deletion Date:</strong> ${deletionDateFormatted}</p>
            ${data.deletedWalletBalance > 0 ? `
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 0; color: #856404;"><strong>⚠️ Wallet Balance Forfeited:</strong> $${data.deletedWalletBalance.toFixed(2)}</p>
              </div>
            ` : ''}
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #333; margin-top: 0;">What Was Deleted</h3>
            <ul style="color: #666; line-height: 1.6;">
              <li>Your profile information and account settings</li>
              <li>Your booking history and event records</li>
              <li>Your saved payment methods</li>
              <li>Your gift card purchases (promotional gift cards remain valid)</li>
              ${data.deletedWalletBalance > 0 ? '<li>Your wallet balance (permanently forfeited)</li>' : ''}
            </ul>
          </div>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #0c5460; margin-top: 0;">Need to Book Again?</h4>
            <p style="color: #0c5460; margin-bottom: 0;">
              You can always create a new account at <a href="https://jumpcsra.com" style="color: #0c5460;">jumpcsra.com</a> 
              if you'd like to use our services again in the future.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #666; font-size: 14px; border-top: 1px solid #dee2e6; padding-top: 20px;">
            <p style="margin: 0;">JumpCSRA Party Rentals</p>
            <p style="margin: 5px 0 0 0;">Thank you for being part of our community</p>
            <p style="margin: 5px 0 0 0;">jumpcsra@gmail.com | (803) 221-0466</p>
          </div>
        </div>
      `,
      categories: ['account-deletion', 'transactional'],
      customArgs: {
        userId: context.auth.uid,
        deletedWalletBalance: data.deletedWalletBalance.toString(),
        deletionDate: data.deletionDate
      }
    };

    await sgMail.send(msg);
    
    console.log(`Account deletion email sent successfully to ${data.userEmail} for user ${context.auth.uid}`);
    
    return { 
      success: true, 
      message: 'Account deletion email sent successfully'
    };

  } catch (error) {
    console.error('Error sending account deletion email:', error);
    
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('SendGrid error response:', (error as any).response?.body);
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to send account deletion email.');
  }
});

// ============================================
// PAYPAL SUBSCRIPTION SYSTEM (OPTIMIZED)
// ============================================

// STATIC PAYPAL PRODUCT AND PLAN IDs - Created once and reused
const JUMP_CLUB_PRODUCT_ID = "PROD_JUMP_CLUB_MEMBERSHIP_2024";
const JUMP_CLUB_PLAN_ID = "P-SANDBOX_JUMP_CLUB_MONTHLY_149"; // Updated to use valid sandbox plan ID

// One-time setup function to create PayPal product and billing plan
// Run this function once via Firebase console or admin script
export const setupPayPalPlans = functions.https.onRequest(async (req, res) => {
  
  try {
    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal product (one-time)
    const productData = {
      id: JUMP_CLUB_PRODUCT_ID,
      name: "Jump Club Membership",
      description: "Monthly subscription to Jump Club with premium inflatable delivery and exclusive member benefits",
      type: "SERVICE",
      category: "SOFTWARE"
    };

    const productResponse = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `product-setup-${Date.now()}`
      },
      body: JSON.stringify(productData)
    });

    
    if (!productResponse.ok) {
      const errorData = await productResponse.json();
      console.error('📦 ERROR: Product creation failed:', errorData);
      throw new Error(`Product creation failed: ${JSON.stringify(errorData)}`);
    }

    const productResult = await productResponse.json();
    console.log('📦 SUCCESS: Product created:', productResult.id);

    // Create billing plan (one-time)
    const planData = {
      product_id: JUMP_CLUB_PRODUCT_ID,
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
          total_cycles: 0, // 0 means unlimited
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
          value: "0",
          currency_code: "USD"
        },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3
      }
    };

    const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `plan-setup-${Date.now()}`
      },
      body: JSON.stringify(planData)
    });


    if (!planResponse.ok) {
      const errorData = await planResponse.json();
      console.error('💳 ERROR: Plan creation failed:', errorData);
      throw new Error(`Plan creation failed: ${JSON.stringify(errorData)}`);
    }

    const planResult = await planResponse.json();
    console.log('💳 SUCCESS: Plan created:', planResult.id);

    // Store the IDs in Firestore for reference
    const db = admin.firestore();
    const configData = {
      productId: productResult.id,
      planId: planResult.id,
      createdAt: new Date(),
      status: 'ACTIVE'
    };
    
    await db.collection('paypalConfig').doc('membershipPlanMonthly').set(configData);

    res.json({
      success: true,
      productId: productResult.id,
      planId: planResult.id,
      message: 'PayPal product and billing plan created successfully!'
    });

  } catch (error: any) {
    console.error('🚨 ERROR: Failed to setup PayPal plans:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error'
    });
  }
});

// Optimized subscription creation function (uses stored plan_id)
export const createMembershipSubscription = functions.https.onCall(async (data, context) => {
  
  try {
    const { userId, planAmount = 149, currency = 'USD', userEmail, userName } = data;

    
    if (!data) {
      console.error('❌ VALIDATION: No data provided');
      throw new functions.https.HttpsError('invalid-argument', 'No data provided');
    }

    if (!userId) {
      console.error('❌ VALIDATION: Missing userId. Data keys:', Object.keys(data));
      throw new functions.https.HttpsError('invalid-argument', `Missing userId. Received data keys: ${Object.keys(data).join(', ')}`);
    }

    if (!userEmail) {
      console.error('❌ VALIDATION: Missing userEmail. Data keys:', Object.keys(data));
      throw new functions.https.HttpsError('invalid-argument', `Missing userEmail. Received data keys: ${Object.keys(data).join(', ')}`);
    }

    if (typeof planAmount !== 'number' || isNaN(planAmount) || planAmount <= 0) {
      console.error('❌ VALIDATION: Invalid planAmount:', planAmount);
      throw new functions.https.HttpsError('invalid-argument', `Invalid planAmount: ${planAmount}. Must be a positive number.`);
    }

    // Check for existing subscription in activeSubscriptions
    const db = admin.firestore();
    const activeSubscriptionsRef = db.collection('users').doc(userId).collection('activeSubscriptions');
    const existingSubscriptions = await activeSubscriptionsRef.get();
    
    if (!existingSubscriptions.empty) {
      console.log('❌ DUPLICATE: User already has an active subscription');
      throw new functions.https.HttpsError('already-exists', 'You already have an active membership subscription. Please cancel your current subscription first if you want to create a new one.');
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Get stored plan ID from Firestore
    const configDoc = await db.collection('paypalConfig').doc('membershipPlanMonthly').get();
    
    if (!configDoc.exists) {
      console.error('❌ CONFIG: PayPal billing plan not configured');
      throw new functions.https.HttpsError('failed-precondition', 'PayPal billing plan not configured. Run setupPayPalPlans first.');
    }
    
    const config = configDoc.data();
    const planId = config?.planId || JUMP_CLUB_PLAN_ID;
    
    if (!planId) {
      console.error('❌ CONFIG: No billing plan ID available');
      throw new functions.https.HttpsError('failed-precondition', 'No billing plan ID available. Run setupPayPalPlans first.');
    }


    // Create subscription using existing plan
    const subscriptionData = {
      plan_id: planId,
      start_time: new Date(Date.now() + 60000).toISOString(), // Start in 1 minute
      subscriber: {
        name: {
          given_name: userName?.split(' ')[0] || 'Jump',
          surname: userName?.split(' ').slice(1).join(' ') || 'Club Member'
        },
        email_address: userEmail
      },
      application_context: {
        brand_name: "JumpCSRA",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
        },
        return_url: `http://localhost:5173/subscription-success?success=true`,
        cancel_url: `http://localhost:5173/subscription-success?cancelled=true`
      },
      custom_id: userId
    };

    const subscriptionResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `sub-${userId}-${Date.now()}`
      },
      body: JSON.stringify(subscriptionData)
    });


    if (!subscriptionResponse.ok) {
      const errorData = await subscriptionResponse.json();
      console.error('💳 ERROR: Subscription creation failed:', errorData);
      throw new functions.https.HttpsError('internal', `Subscription creation failed: ${JSON.stringify(errorData)}`);
    }

    const subscriptionResult = await subscriptionResponse.json();
    console.log('💳 SUCCESS: Subscription created:', subscriptionResult.id);

    // Find approval URL
    const approvalLink = subscriptionResult.links?.find((link: any) => link.rel === 'approve');
    const approvalUrl = approvalLink?.href;

    if (!approvalUrl) {
      console.error('❌ ERROR: No approval URL in subscription response');
      throw new functions.https.HttpsError('internal', 'No approval URL received from PayPal');
    }

    console.log('✅ SUCCESS: Approval URL found:', approvalUrl);

    // Store subscription in database BEFORE returning approval URL
    const subscriptionRecord = {
      subscriptionId: subscriptionResult.id,
      userId: userId,
      status: 'PENDING_APPROVAL',
      planId: planId,
      amount: planAmount,
      currency: currency,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      paypalData: subscriptionResult,
      debug: {
        createdVia: 'createMembershipSubscription',
        timestamp: new Date().toISOString(),
        paypalResponseStatus: subscriptionResponse.status
      }
    };


    try {
      // Store ONLY in activeSubscriptions collection (no dual write)
      await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionResult.id).set(subscriptionRecord);
      
      console.log('✅ DATABASE: Subscription stored in activeSubscriptions collection');
      
      // Verify the document was created by reading it back
      const verifyDoc = await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionResult.id).get();
      if (verifyDoc.exists) {
        console.log('✅ VERIFY: Document exists in database:', verifyDoc.id);
        console.log('📊 VERIFY: Document data:', JSON.stringify(verifyDoc.data(), null, 2));
      } else {
        console.error('❌ VERIFY: Document was not found after creation!');
      }
    } catch (dbError) {
      console.error('❌ DATABASE ERROR: Failed to store subscription:', dbError);
      console.error('📊 DATABASE ERROR details:', {
        userId,
        subscriptionId: subscriptionResult.id,
        error: dbError instanceof Error ? dbError.message : 'Unknown error',
        stack: dbError instanceof Error ? dbError.stack : undefined
      });
      
      // Don't fail the entire function, but log the issue
      console.log('⚠️ WARNING: Proceeding despite database storage issue');
    }


    return {
      success: true,
      subscriptionId: subscriptionResult.id,
      approvalUrl: approvalUrl,
      status: 'PENDING_APPROVAL'
    };

  } catch (error: any) {
    console.error('🚨 ERROR: Subscription creation failed:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', `Subscription creation error: ${error.message}`);
  }
});

// Webhook handler for PayPal subscription events
export const paypalSubscriptionWebhook = functions.https.onRequest(async (req, res) => {
  
  try {
    const event = req.body;

    const db = admin.firestore();

    switch (event.event_type) {
      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        {
          console.log('✅ WEBHOOK: Subscription activated');
          const subscription = event.resource;
          const userId = subscription.custom_id;
          const subscriptionId = subscription.id;
          
          if (userId && subscriptionId) {
            // Update only activeSubscriptions collection
            await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionId).update({
              status: 'ACTIVE',
              activatedAt: new Date(),
              lastWebhookEvent: event.event_type,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ WEBHOOK: Subscription activated in activeSubscriptions:', userId);
          }
        }
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
        {
          console.log('❌ WEBHOOK: Subscription cancelled');
          const subscription = event.resource;
          const userId = subscription.custom_id;
          const subscriptionId = subscription.id;
          
          if (userId && subscriptionId) {
            // Mark as cancelled in activeSubscriptions (don't delete yet)
            await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionId).update({
              status: 'CANCELLED',
              cancelledAt: new Date(),
              lastWebhookEvent: event.event_type,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              // Calculate end date (30 days from cancellation for monthly subscription)
              endsAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
            });
            console.log('❌ WEBHOOK: Subscription marked as cancelled in activeSubscriptions:', userId);
          }
        }
        break;

      case 'BILLING.SUBSCRIPTION.SUSPENDED':
        {
          console.log('⏸️ WEBHOOK: Subscription suspended');
          const subscription = event.resource;
          const userId = subscription.custom_id;
          const subscriptionId = subscription.id;
          
          if (userId && subscriptionId) {
            // Update status in activeSubscriptions
            await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionId).update({
              status: 'SUSPENDED',
              suspendedAt: new Date(),
              lastWebhookEvent: event.event_type,
              lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('⏸️ WEBHOOK: Subscription suspended in activeSubscriptions:', userId);
          }
        }
        break;

      case 'BILLING.SUBSCRIPTION.EXPIRED':
        {
          console.log('⏰ WEBHOOK: Subscription expired - migrating to history');
          const subscription = event.resource;
          const userId = subscription.custom_id;
          const subscriptionId = subscription.id;
          
          if (userId && subscriptionId) {
            try {
              // Read current subscription data from activeSubscriptions
              const activeSubDoc = await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionId).get();
              
              if (activeSubDoc.exists) {
                const subscriptionData = activeSubDoc.data();
                
                // Copy to subscriptionHistory with final status
                const historyData = {
                  ...subscriptionData,
                  status: 'EXPIRED',
                  expiredAt: new Date(),
                  lastWebhookEvent: event.event_type,
                  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
                  migratedToHistoryAt: admin.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('users').doc(userId).collection('subscriptionHistory').doc(subscriptionId).set(historyData);
                console.log('✅ WEBHOOK: Subscription copied to history:', subscriptionId);
                
                // Delete from activeSubscriptions
                await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionId).delete();
                console.log('✅ WEBHOOK: Subscription removed from activeSubscriptions:', subscriptionId);
              } else {
                console.warn('⚠️ WEBHOOK: Subscription not found in activeSubscriptions:', subscriptionId);
              }
            } catch (migrationError) {
              console.error('❌ WEBHOOK: Error migrating expired subscription:', migrationError);
            }
          }
        }
        break;

      case 'PAYMENT.SALE.COMPLETED':
        {
          console.log('💰 WEBHOOK: Payment completed');
          const payment = event.resource;
          const subscriptionId = payment.billing_agreement_id;
          
          if (subscriptionId) {
            // Log successful payment
            await db.collection('subscriptionPayments').add({
              subscriptionId: subscriptionId,
              amount: payment.amount?.total,
              currency: payment.amount?.currency,
              paymentId: payment.id,
              completedAt: new Date(),
              webhookEvent: event.event_type
            });
            
            console.log('💰 WEBHOOK: Payment logged:', payment.id);
          }
        }
        break;

      default:
        console.log('📡 WEBHOOK: Unhandled event type:', event.event_type);
    }


    res.status(200).send('OK');

  } catch (error: any) {
    console.error('🚨 WEBHOOK ERROR:', error);
    res.status(500).send('Error');
  }
});

// Get PayPal subscription details
export const getPayPalSubscriptionDetails = functions.https.onCall(async (data, context) => {
  
  try {
    const { subscriptionId } = data;
    
    if (!subscriptionId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing subscriptionId');
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Get subscription details from PayPal
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ PayPal subscription details error:', errorData);
      throw new Error(`Failed to get subscription details: ${errorData}`);
    }

    const subscription = await response.json();
    console.log('✅ Subscription details retrieved:', subscription.id);

    return {
      success: true,
      subscription: subscription
    };

  } catch (error: any) {
    console.error('💥 Error getting subscription details:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to get subscription details',
      { error: error.message }
    );
  }
});

// Cancel PayPal subscription
export const cancelPayPalSubscription = functions.region('us-central1').https.onCall(async (data, context) => {
  console.log('🚨 CANCEL BACKEND: Function called with data:', JSON.stringify(data, null, 2));
  console.log('🚨 CANCEL BACKEND: Context auth:', context.auth?.uid);
  
  try {
    const { subscriptionId, reason = 'User requested cancellation' } = data;
    
    console.log('🔍 CANCEL BACKEND: Extracted subscriptionId:', subscriptionId);
    console.log('🔍 CANCEL BACKEND: Extracted reason:', reason);
    
    // Verify user is authenticated
    if (!context.auth?.uid) {
      console.error('❌ CANCEL BACKEND: User not authenticated');
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!subscriptionId) {
      console.error('❌ CANCEL BACKEND: Missing subscriptionId');
      throw new functions.https.HttpsError('invalid-argument', 'Missing subscriptionId');
    }

    console.log('✅ CANCEL BACKEND: Validation passed, proceeding with cancellation...');

    // Get PayPal access token
    console.log('🔑 CANCEL BACKEND: Getting PayPal access token...');
    const accessToken = await getPayPalAccessToken();
    console.log('🔑 CANCEL BACKEND: Got PayPal access token successfully');

    // Cancel subscription in PayPal
    console.log('📞 CANCEL BACKEND: Calling PayPal API to cancel subscription:', subscriptionId);
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        reason: reason
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ CANCEL BACKEND: PayPal cancellation error:', errorData);
      console.error('❌ CANCEL BACKEND: PayPal response status:', response.status);
      console.error('❌ CANCEL BACKEND: PayPal response headers:', response.headers);
      throw new Error(`Failed to cancel subscription: ${errorData}`);
    }

    console.log('✅ CANCEL BACKEND: PayPal cancellation successful');

    // Update subscription status with new logic (mark as cancelled, don't delete)
    console.log('📊 CANCEL BACKEND: Updating subscription status to CANCELLED...');
    const db = admin.firestore();
    const userId = context.auth.uid;
    
    console.log('📍 CANCEL BACKEND: ActiveSubscriptions path: users/' + userId + '/activeSubscriptions/' + subscriptionId);
    
    // Mark as cancelled in activeSubscriptions (don't delete yet - let it expire naturally)
    await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionId).update({
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancellationReason: reason,
      lastWebhookEvent: 'MANUAL_CANCELLATION',
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      // Calculate end date (30 days from cancellation for monthly subscription)
      endsAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
    });
    console.log('✅ CANCEL BACKEND: Subscription marked as cancelled in activeSubscriptions:', subscriptionId);

    console.log('✅ CANCEL BACKEND: Subscription cancelled successfully:', subscriptionId);

    return {
      success: true,
      message: 'Subscription cancelled successfully'
    };

  } catch (error: any) {
    console.error('💥 CANCEL BACKEND: Error cancelling subscription:', error);
    console.error('💥 CANCEL BACKEND: Error details:', {
      message: error.message,
      stack: error.stack,
      userId: context.auth?.uid,
      subscriptionId: data?.subscriptionId
    });
    throw new functions.https.HttpsError(
      'internal',
      'Failed to cancel subscription',
      { error: error.message }
    );
  }
});

// Reactivate PayPal subscription
export const reactivatePayPalSubscription = functions.region('us-central1').https.onCall(async (data, context) => {
  
  try {
    const { subscriptionId } = data;
    
    // Verify user is authenticated
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    if (!subscriptionId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing subscriptionId');
    }

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // First, get the current subscription status
    const statusResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!statusResponse.ok) {
      const errorData = await statusResponse.text();
      console.error('❌ PayPal status check error:', errorData);
      throw new Error(`Failed to check subscription status: ${errorData}`);
    }

    const subscriptionDetails = await statusResponse.json();
    console.log('📊 Current PayPal subscription status:', subscriptionDetails.status);

    let reactivationResult;

    // Handle different subscription statuses
    if (subscriptionDetails.status === 'SUSPENDED') {
      // For suspended subscriptions, use the activate endpoint
      console.log('🔄 Attempting to activate suspended subscription...');
      const activateResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          reason: 'User requested reactivation'
        })
      });

      if (!activateResponse.ok) {
        const errorData = await activateResponse.text();
        console.error('❌ PayPal activation error:', errorData);
        throw new Error(`Failed to activate subscription: ${errorData}`);
      }

      reactivationResult = { method: 'activated', status: 'ACTIVE' };

    } else if (subscriptionDetails.status === 'CANCELLED') {
      // For cancelled subscriptions, we need to create a new subscription
      console.log('🆕 Cancelled subscription detected. Creating new subscription...');
      
      // Get the plan ID from the original subscription
      const planId = subscriptionDetails.plan_id;
      console.log('📋 Using plan ID:', planId);

      // Create new subscription with the same plan
      const newSubscriptionResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'PayPal-Request-Id': `reactivate-${Date.now()}-${context.auth.uid}`
        },
        body: JSON.stringify({
          plan_id: planId,
          start_time: new Date(Date.now() + 60000).toISOString(), // Start 1 minute from now
          subscriber: {
            name: {
              given_name: subscriptionDetails.subscriber?.name?.given_name || "Member",
              surname: subscriptionDetails.subscriber?.name?.surname || "User"
            },
            email_address: subscriptionDetails.subscriber?.email_address
          },
          application_context: {
            brand_name: "Jump Castle Rentals & Amusement",
            locale: "en-US",
            shipping_preference: "NO_SHIPPING",
            user_action: "SUBSCRIBE_NOW",
            payment_method: {
              payer_selected: "PAYPAL",
              payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
            },
            return_url: `http://localhost:5173/subscription-success?success=true`,
            cancel_url: `http://localhost:5173/subscription-success?cancelled=true`
          },
          custom_id: context.auth.uid
        })
      });

      if (!newSubscriptionResponse.ok) {
        const errorData = await newSubscriptionResponse.text();
        console.error('❌ PayPal new subscription error:', errorData);
        throw new Error(`Failed to create new subscription: ${errorData}`);
      }

      const newSubscription = await newSubscriptionResponse.json();
      console.log('🆕 New subscription created:', newSubscription.id);

      // Create new subscription record in the dual-collection structure
      const db = admin.firestore();
      const newSubscriptionRecord = {
        subscriptionId: newSubscription.id,
        status: 'PENDING_APPROVAL',
        planId: planId,
        paypalData: newSubscription,
        reactivatedAt: new Date(),
        createdAt: new Date(),
        userId: context.auth.uid,
        lastWebhookEvent: 'NEW_SUBSCRIPTION_CREATED'
      };
      
      // Store only in activeSubscriptions - will move to history when expired
      await db.collection('users').doc(context.auth.uid).collection('activeSubscriptions').doc(newSubscription.id).set(newSubscriptionRecord);

      // Return approval URL for user to complete
      const approvalLink = newSubscription.links?.find((link: any) => link.rel === 'approve');
      
      return {
        success: true,
        requiresApproval: true,
        approvalUrl: approvalLink?.href,
        newSubscriptionId: newSubscription.id,
        message: 'New subscription created. Please complete the approval process.'
      };

    } else if (subscriptionDetails.status === 'ACTIVE') {
      // Already active
      console.log('✅ Subscription is already active');
      reactivationResult = { method: 'already_active', status: 'ACTIVE' };
      
    } else {
      // Unknown status
      throw new Error(`Cannot reactivate subscription with status: ${subscriptionDetails.status}`);
    }

    // Update subscription status in Firestore dual-collection structure for activated subscriptions
    const db = admin.firestore();
    const updateData = {
      status: 'Active',
      reactivatedAt: new Date(),
      lastWebhookEvent: 'MANUAL_REACTIVATION',
      paypalStatus: reactivationResult.status
    };
    
    // Update activeSubscriptions
    await db.collection('users').doc(context.auth.uid).collection('activeSubscriptions').doc(subscriptionId).update(updateData);
    // Update subscriptionHistory
    await db.collection('users').doc(context.auth.uid).collection('subscriptionHistory').doc(subscriptionId).update(updateData);

    console.log('✅ Subscription reactivated successfully:', subscriptionId);

    return {
      success: true,
      message: 'Subscription reactivated successfully',
      method: reactivationResult.method
    };

  } catch (error: any) {
    console.error('💥 Error reactivating subscription:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to reactivate subscription',
      { error: error.message }
    );
  }
});

// Function to activate subscription after successful PayPal approval
export const activateSubscription = functions.region('us-central1').https.onCall(async (data, context) => {
  console.log('🎯 ACTIVATE SUBSCRIPTION: Function called', data);
  
  if (!context.auth) {
    console.error('❌ ACTIVATE SUBSCRIPTION: User not authenticated');
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { subscriptionId, baToken } = data;
  const db = admin.firestore();
  
  if (!subscriptionId) {
    console.error('❌ ACTIVATE SUBSCRIPTION: Missing subscription ID');
    throw new functions.https.HttpsError('invalid-argument', 'Subscription ID is required');
  }

  try {
    console.log('📋 ACTIVATE SUBSCRIPTION: Getting PayPal subscription details', subscriptionId);
    
    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();
    console.log('🔑 ACTIVATE SUBSCRIPTION: Got PayPal access token');
    
    // Get subscription details from PayPal
    const subscriptionResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!subscriptionResponse.ok) {
      const errorText = await subscriptionResponse.text();
      console.error('❌ ACTIVATE SUBSCRIPTION: PayPal API error:', errorText);
      throw new Error(`PayPal API error: ${errorText}`);
    }

    const subscriptionDetails = await subscriptionResponse.json();
    console.log('📊 ACTIVATE SUBSCRIPTION: PayPal subscription details:', JSON.stringify(subscriptionDetails, null, 2));
    
    // Check if subscription is active or if user successfully completed payment
    const isActive = subscriptionDetails.status === 'ACTIVE';
    const isApprovalPending = subscriptionDetails.status === 'APPROVAL_PENDING';
    const hasValidPaymentMethod = subscriptionDetails.subscriber && subscriptionDetails.subscriber.payment_source;
    
    console.log('✅ ACTIVATE SUBSCRIPTION: PayPal status:', subscriptionDetails.status);
    console.log('✅ ACTIVATE SUBSCRIPTION: Is active:', isActive);
    console.log('✅ ACTIVATE SUBSCRIPTION: Is approval pending:', isApprovalPending);
    console.log('✅ ACTIVATE SUBSCRIPTION: Has payment method:', hasValidPaymentMethod);
    
    // If user completed payment but PayPal hasn't updated status yet, 
    // and we have a baToken (successful return from PayPal), treat as active
    let finalStatus = 'Failed';
    let shouldManuallyActivate = false;
    
    if (isActive) {
      finalStatus = 'Active';
      console.log('✅ ACTIVATE SUBSCRIPTION: Setting status to Active - PayPal confirms ACTIVE');
    } else if (isApprovalPending && baToken) {
      // User completed payment, but PayPal status is still pending
      // Try to manually activate the subscription
      shouldManuallyActivate = true;
      console.log('🔄 ACTIVATE SUBSCRIPTION: Will attempt manual activation - User completed payment');
    } else if (isApprovalPending) {
      finalStatus = 'PENDING_APPROVAL';
      console.log('⏳ ACTIVATE SUBSCRIPTION: Setting status to PENDING_APPROVAL - Still awaiting user action');
    }
    
    // Attempt manual activation if needed
    if (shouldManuallyActivate) {
      try {
        console.log('🔄 ACTIVATE SUBSCRIPTION: Attempting manual PayPal activation...');
        const activateResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${subscriptionId}/activate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            reason: 'User completed payment process'
          })
        });
        
        if (activateResponse.ok) {
          console.log('✅ ACTIVATE SUBSCRIPTION: Manual activation successful');
          finalStatus = 'Active';
        } else {
          const activateError = await activateResponse.text();
          console.log('⚠️ ACTIVATE SUBSCRIPTION: Manual activation failed:', activateError);
          // Even if manual activation fails, if user has baToken, they completed payment
          finalStatus = 'Active';
          console.log('✅ ACTIVATE SUBSCRIPTION: Treating as Active due to completed payment (baToken present)');
        }
      } catch (activateError) {
        console.log('⚠️ ACTIVATE SUBSCRIPTION: Manual activation error:', activateError);
        // Even if manual activation fails, if user has baToken, they completed payment
        finalStatus = 'Active';
        console.log('✅ ACTIVATE SUBSCRIPTION: Treating as Active due to completed payment (baToken present)');
      }
    }
    
    // Update subscription in Firestore
    const updateData: any = {
      subscriptionId: subscriptionId,
      userId: context.auth.uid,
      status: finalStatus,
      paypalStatus: subscriptionDetails.status,
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
      paypalDetails: subscriptionDetails,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      planId: subscriptionDetails.plan_id,
      amount: subscriptionDetails.billing_info?.last_payment?.amount?.value ? parseFloat(subscriptionDetails.billing_info.last_payment.amount.value) : 149,
      currency: subscriptionDetails.billing_info?.last_payment?.amount?.currency_code || 'USD',
      createdAt: subscriptionDetails.create_time ? new Date(subscriptionDetails.create_time) : admin.firestore.FieldValue.serverTimestamp()
    };

    if (baToken) {
      updateData.baToken = baToken;
    }

    console.log('💾 ACTIVATE SUBSCRIPTION: Updating Firestore (activeSubscriptions only):', JSON.stringify(updateData, null, 2));
    console.log('📍 ACTIVATE SUBSCRIPTION: ActiveSubscriptions path: users/${context.auth.uid}/activeSubscriptions/${subscriptionId}');
    
    // First, check if document already exists in activeSubscriptions
    const activeDocRef = db.collection('users').doc(context.auth.uid).collection('activeSubscriptions').doc(subscriptionId);
    console.log('🔍 ACTIVATE SUBSCRIPTION: Checking if document already exists in activeSubscriptions...');
    
    try {
      const existingDoc = await activeDocRef.get();
      if (existingDoc.exists) {
        console.log('📋 ACTIVATE SUBSCRIPTION: Document already exists in activeSubscriptions, current data:', JSON.stringify(existingDoc.data(), null, 2));
      } else {
        console.log('📋 ACTIVATE SUBSCRIPTION: Document does not exist in activeSubscriptions, will create new one');
      }
    } catch (checkError) {
      console.error('⚠️ ACTIVATE SUBSCRIPTION: Error checking existing document:', checkError);
    }
    
    // Only update activeSubscriptions - history will be populated when subscription expires/cancels
    try {
      // Update activeSubscriptions (for fast queries)
      await activeDocRef.set(updateData, { merge: true });
      console.log('✅ ACTIVATE SUBSCRIPTION: ActiveSubscriptions update completed successfully');
      
      // Verify the document was written by reading it back from activeSubscriptions
      const verifyDoc = await activeDocRef.get();
      if (verifyDoc.exists) {
        console.log('✅ VERIFY ACTIVATION: Document exists after update in activeSubscriptions:', verifyDoc.id);
        console.log('📊 VERIFY ACTIVATION: Final document data:', JSON.stringify(verifyDoc.data(), null, 2));
      } else {
        console.error('❌ VERIFY ACTIVATION: Document was not found in activeSubscriptions after update!');
        throw new Error('Document verification failed - document not found in activeSubscriptions after update');
      }
    } catch (updateError) {
      console.error('❌ ACTIVATE SUBSCRIPTION: Firestore update failed:', updateError);
      console.error('📊 UPDATE ERROR details:', {
        userId: context.auth.uid,
        subscriptionId,
        error: updateError instanceof Error ? updateError.message : 'Unknown error',
        stack: updateError instanceof Error ? updateError.stack : undefined
      });
      throw updateError;
    }
    
    console.log('🎉 ACTIVATE SUBSCRIPTION: Successfully processed subscription in activeSubscriptions');
    console.log('✅ ACTIVATE SUBSCRIPTION: Document should now exist at users/' + context.auth.uid + '/activeSubscriptions/' + subscriptionId);
    
    return { 
      success: true, 
      status: finalStatus,
      subscriptionDetails: subscriptionDetails,
      message: finalStatus === 'Active' ? 'Subscription successfully activated!' : 
               finalStatus === 'PENDING_APPROVAL' ? 'Subscription pending user approval' :
               'Subscription activation failed'
    };

  } catch (error) {
    console.error('❌ ACTIVATE SUBSCRIPTION: Error:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to activate subscription',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
});

// Debug function to check subscription database state
export const debugSubscriptionDatabase = functions.https.onCall(async (data, context) => {
  
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userId, subscriptionId } = data;
  const targetUserId = userId || context.auth.uid;
  
  try {
    const db = admin.firestore();
    
    // Get active subscriptions
    const activeSubscriptionsRef = db.collection('users').doc(targetUserId).collection('activeSubscriptions');
    const activeSubscriptions = await activeSubscriptionsRef.get();
    
    // Get subscription history
    const historySubscriptionsRef = db.collection('users').doc(targetUserId).collection('subscriptionHistory');
    const historySubscriptions = await historySubscriptionsRef.get();
    
    
    const activeSubscriptionsList: any[] = [];
    activeSubscriptions.forEach(doc => {
      const data = doc.data();
      activeSubscriptionsList.push({
        documentId: doc.id,
        collection: 'activeSubscriptions',
        data: data
      });
    });
    
    const historySubscriptionsList: any[] = [];
    historySubscriptions.forEach(doc => {
      const data = doc.data();
      historySubscriptionsList.push({
        documentId: doc.id,
        collection: 'subscriptionHistory',
        data: data
      });
    });
    
    // If specific subscriptionId provided, check that document in both collections
    if (subscriptionId) {
      
      const activeDoc = await activeSubscriptionsRef.doc(subscriptionId).get();
      const historyDoc = await historySubscriptionsRef.doc(subscriptionId).get();
      
      if (activeDoc.exists) {
      } else {
      }
      
      if (historyDoc.exists) {
      } else {
      }
    }
    
    // Also check if user document exists
    const userDoc = await db.collection('users').doc(targetUserId).get();
    if (userDoc.exists) {
    }
    
    return {
      success: true,
      userId: targetUserId,
      activeSubscriptionsCount: activeSubscriptions.size,
      historySubscriptionsCount: historySubscriptions.size,
      activeSubscriptions: activeSubscriptionsList,
      historySubscriptions: historySubscriptionsList,
      userDocumentExists: userDoc.exists,
      userDocumentData: userDoc.exists ? userDoc.data() : null
    };
    
  } catch (error: any) {
    console.error('❌ DEBUG ERROR:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Debug function failed',
      { error: error.message }
    );
  }
});

// Simple callable function to trigger PayPal plan setup
export const triggerPayPalSetup = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔧 SETUP: Triggering PayPal plan creation...');
    
    // Get PayPal access token
    const accessToken = await getPayPalAccessToken();

    // Create PayPal product (one-time)
    const productData = {
      id: JUMP_CLUB_PRODUCT_ID,
      name: "Jump Club Membership",
      description: "Monthly subscription to Jump Club with premium inflatable delivery and exclusive member benefits",
      type: "SERVICE",
      category: "SOFTWARE"
    };

    const productResponse = await fetch(`${PAYPAL_BASE_URL}/v1/catalogs/products`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `product-setup-${Date.now()}`
      },
      body: JSON.stringify(productData)
    });

    if (!productResponse.ok) {
      const errorData = await productResponse.json();
      console.error('📦 ERROR: Product creation failed:', errorData);
      throw new functions.https.HttpsError('internal', `Product creation failed: ${JSON.stringify(errorData)}`);
    }

    const productResult = await productResponse.json();
    console.log('📦 SUCCESS: Product created:', productResult.id);

    // Create billing plan (one-time)
    const planData = {
      product_id: JUMP_CLUB_PRODUCT_ID,
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
          total_cycles: 0, // 0 means unlimited
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
          value: "0",
          currency_code: "USD"
        },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3
      }
    };

    const planResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `plan-setup-${Date.now()}`
      },
      body: JSON.stringify(planData)
    });

    if (!planResponse.ok) {
      const errorData = await planResponse.json();
      console.error('💳 ERROR: Plan creation failed:', errorData);
      throw new functions.https.HttpsError('internal', `Plan creation failed: ${JSON.stringify(errorData)}`);
    }

    const planResult = await planResponse.json();
    console.log('💳 SUCCESS: Plan created:', planResult.id);

    // Store the IDs in Firestore for reference
    const db = admin.firestore();
    const configData = {
      productId: productResult.id,
      planId: planResult.id,
      createdAt: new Date(),
      status: 'ACTIVE'
    };
    
    await db.collection('paypalConfig').doc('membershipPlanMonthly').set(configData);

    return {
      success: true,
      productId: productResult.id,
      planId: planResult.id,
      message: 'PayPal product and billing plan created successfully!'
    };

  } catch (error) {
    console.error('🚨 SETUP ERROR:', error);
    throw new functions.https.HttpsError('internal', 'Failed to setup PayPal plans', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Daily cleanup function - migrate expired cancelled subscriptions to history
export const dailySubscriptionCleanup = functions.pubsub.schedule('0 2 * * *')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    console.log('🧹 CLEANUP: Starting daily subscription cleanup');
    
    const db = admin.firestore();
    const now = new Date();
    let processedCount = 0;
    let errorCount = 0;
    
    try {
      // Get all users (we need to check each user's activeSubscriptions)
      const usersSnapshot = await db.collection('users').get();
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        try {
          // Get all active subscriptions for this user
          const activeSubscriptionsSnapshot = await db.collection('users')
            .doc(userId)
            .collection('activeSubscriptions')
            .where('status', '==', 'CANCELLED')
            .get();
          
          for (const subDoc of activeSubscriptionsSnapshot.docs) {
            const subscriptionData = subDoc.data();
            const subscriptionId = subDoc.id;
            
            // Check if subscription has ended (endsAt < now)
            if (subscriptionData.endsAt && subscriptionData.endsAt.toDate() < now) {
              console.log(`🧹 CLEANUP: Migrating expired cancelled subscription ${subscriptionId} for user ${userId}`);
              
              try {
                // Copy to subscriptionHistory
                const historyData = {
                  ...subscriptionData,
                  migratedToHistoryAt: admin.firestore.FieldValue.serverTimestamp(),
                  migratedBy: 'dailyCleanup',
                  finalStatus: 'EXPIRED_CANCELLED'
                };
                
                await db.collection('users').doc(userId).collection('subscriptionHistory').doc(subscriptionId).set(historyData);
                console.log(`✅ CLEANUP: Copied to history: ${subscriptionId}`);
                
                // Delete from activeSubscriptions
                await db.collection('users').doc(userId).collection('activeSubscriptions').doc(subscriptionId).delete();
                console.log(`✅ CLEANUP: Removed from active: ${subscriptionId}`);
                
                processedCount++;
              } catch (migrationError) {
                console.error(`❌ CLEANUP: Error migrating subscription ${subscriptionId}:`, migrationError);
                errorCount++;
              }
            }
          }
        } catch (userError) {
          console.error(`❌ CLEANUP: Error processing user ${userId}:`, userError);
          errorCount++;
        }
      }
      
      console.log(`🧹 CLEANUP: Completed - Processed: ${processedCount}, Errors: ${errorCount}`);
      
    } catch (error) {
      console.error('❌ CLEANUP: Fatal error during daily cleanup:', error);
    }
  });
