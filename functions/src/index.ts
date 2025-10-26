import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as sgMail from '@sendgrid/mail';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize SendGrid with API key from environment variables
const sendGridApiKey = functions.config().sendgrid?.api_key;
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
}

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
      from: {
        email: 'noreply@jumpcsra.com', // Replace with your verified sender email
        name: 'JumpCSRA Party Rentals'
      },
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
            email: 'noreply@jumpcsra.com', // Replace with your verified sender email
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
export const sendOrderConfirmationEmail = functions.https.onCall(async (data: OrderConfirmationEmailData, context) => {
  // Verify that the user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to send order confirmation emails.');
  }

  try {
    // Validate input data
    if (!data.recipientEmail || !data.orderID || !data.totalAmount) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required email data.');
    }

    if (!sendGridApiKey) {
      throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
    }

    const msg = {
      to: data.recipientEmail,
      from: {
        email: 'noreply@jumpcsra.com', // Replace with your verified sender email
        name: 'JumpCSRA Party Rentals'
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

    await sgMail.send(msg);
    
    // Log successful email send
    console.log(`Order confirmation email sent successfully to ${data.recipientEmail} for order ${data.orderID}`);
    
    return { 
      success: true, 
      message: 'Order confirmation email sent successfully',
      emailSent: true
    };

  } catch (error) {
    console.error('Error sending order confirmation email:', error);
    
    // If it's a SendGrid error, provide more specific information
    if (error && typeof error === 'object' && 'response' in error) {
      console.error('SendGrid error response:', (error as any).response?.body);
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to send order confirmation email.');
  }
});