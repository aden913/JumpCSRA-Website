import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

// Export test function
export { testFunction } from './test';

// Simple PayPal debug test
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
  .onCreate(async (snap, context) => {
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
    console.log('🔍 PAYPAL DEBUG - About to call:', `${PAYPAL_BASE_URL}/v2/invoicing/invoices`);
    console.log('🔍 PAYPAL DEBUG - Payload:', JSON.stringify(invoicePayload, null, 2));
    
    const createResponse = await fetch(`${PAYPAL_BASE_URL}/v2/invoicing/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `${data.orderID}-${Date.now()}`
      },
      body: JSON.stringify(invoicePayload)
    });
    
    console.log('🔍 PAYPAL DEBUG - Response received, status:', createResponse.status);
    console.log('🔍 PAYPAL DEBUG - Response ok:', createResponse.ok);
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ FIREBASE FUNCTION - PayPal create invoice error:', errorText);
      console.error('🔍 PAYPAL DEBUG - Error response body:', errorText);
      throw new functions.https.HttpsError('internal', `PayPal API error: ${createResponse.status}`);
    }
    
    console.log('📋 FIREBASE FUNCTION - PayPal response status:', createResponse.status);
    console.log('📋 FIREBASE FUNCTION - PayPal response headers:', createResponse.headers);
    
    const invoice = await createResponse.json();
    
    // Enhanced debugging - let's see what PayPal actually returns
    console.log('� PAYPAL DEBUG - Full response object:', JSON.stringify(invoice, null, 2));
    console.log('🔍 PAYPAL DEBUG - Object keys:', Object.keys(invoice || {}));
    console.log('🔍 PAYPAL DEBUG - invoice.id:', invoice?.id);
    console.log('🔍 PAYPAL DEBUG - invoice.invoice_id:', invoice?.invoice_id);
    console.log('🔍 PAYPAL DEBUG - invoice.href:', invoice?.href);
    console.log('🔍 PAYPAL DEBUG - invoice.links:', invoice?.links);
    
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

// Scheduled function to auto-cancel pending orders on event day
export const autoCancelPendingOrders = functions.pubsub
  .schedule('0 8 * * *') // Run daily at 8 AM
  .timeZone('America/New_York') // EST/EDT timezone
  .onRun(async (context) => {
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
}, context) => {
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
