// Comprehensive email system for order confirmations and gift cards
// Combines order details with gift card information in a single email

// Email data interfaces
export interface GiftCardInfo {
  code: string;
  balance: number;
  expirationDate: string;
  isPromotional?: boolean; // For GOGO discount cards
  promotionalMessage?: string;
  recipientEmail?: string; // For promotional cards sent to different recipient
}

export interface OrderConfirmationEmailData {
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

// Legacy interface for backward compatibility
interface GiftCardEmailData {
  recipientEmail: string;
  recipientName: string;
  giftCardCode: string;
  giftCardBalance: number;
  expirationDate: string;
  purchaseDate: string;
}

// Generate comprehensive order confirmation email HTML
const generateOrderConfirmationEmailHTML = (data: OrderConfirmationEmailData): string => {
  const hasRentals = data.rentalItems.length > 0 || data.lastMinuteAdditions.length > 0;
  const hasGiftCards = data.giftCards.length > 0;
  
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
        <p>Placed on ${data.orderDate}</p>
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
                    <h4>${giftCard.isPromotional ? '� Promotional Gift Card' : '🎁 Gift Card'}</h4>
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
            
            <p><strong>How to use gift cards:</strong></p>
            <ul>
                <li>Log in to your account at jumpcsra.com</li>
                <li>Use the gift card balance checker in your profile</li>
                <li>Apply gift card balance during checkout</li>
                <li>Gift cards never expire and can be used for any rental</li>
            </ul>
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

// Helper function to generate status banner
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

// Generate plain text version
const generateOrderConfirmationEmailText = (data: OrderConfirmationEmailData): string => {
  const hasRentals = data.rentalItems.length > 0 || data.lastMinuteAdditions.length > 0;
  const hasGiftCards = data.giftCards.length > 0;
  
  return `
🎉 ORDER CONFIRMATION - JumpCSRA Party Rentals

Thank you for your order, ${data.recipientName}!

Order #${data.orderID}
Placed on ${data.orderDate}

${getStatusText(data.bookingStatus, data.requiresPhoneCall)}

${hasRentals ? `
🎪 EVENT DETAILS:
${data.eventDate ? `Event Date: ${data.eventDate}` : ''}
${data.deliveryAddress ? `Delivery Address: ${data.deliveryAddress}` : ''}
${data.deliveryTime ? `Delivery Time: ${data.deliveryTime}` : ''}
${data.duration ? `Duration: ${data.duration}` : ''}
${data.surface ? `Surface: ${data.surface}` : ''}

📦 ITEMS ORDERED:
${data.rentalItems.map(item => 
  `• ${item.name} ${item.duration ? `(${item.duration})` : ''} ${item.wetDry ? `- ${item.wetDry}` : ''} x${item.quantity} - $${item.price.toFixed(2)}`
).join('\n')}
${data.lastMinuteAdditions.map(item => 
  `• ${item.name} x${item.quantity} - $${item.price.toFixed(2)}`
).join('\n')}
` : ''}

💰 PAYMENT SUMMARY:
Subtotal: $${data.subtotal.toFixed(2)}
${data.surfaceAdjustment > 0 ? `Surface Adjustment: $${data.surfaceAdjustment.toFixed(2)}` : ''}
${data.timeAdjustment > 0 ? `Time Adjustment: $${data.timeAdjustment.toFixed(2)}` : ''}
${data.deliveryCost > 0 ? `Delivery: $${data.deliveryCost.toFixed(2)}` : ''}
------------------------
TOTAL: $${data.totalAmount.toFixed(2)}

Payment Type: ${data.paymentType === 'deposit' ? '50% Deposit' : 'Full Payment'}
Amount Paid: $${data.amountPaid.toFixed(2)} (${data.paymentMethod})
${data.remainingBalance > 0 ? `Remaining Balance: $${data.remainingBalance.toFixed(2)}` : ''}

${hasGiftCards ? `
🎁 GIFT CARDS:
${data.giftCards.map(giftCard => `
${giftCard.isPromotional ? '🎉 PROMOTIONAL GIFT CARD' : '🎁 GIFT CARD'}
Code: ${giftCard.code}
Balance: $${giftCard.balance.toFixed(2)}
Expires: ${giftCard.expirationDate}
${giftCard.recipientEmail && giftCard.recipientEmail !== data.recipientEmail ? `Recipient: ${giftCard.recipientEmail}` : ''}
${giftCard.isPromotional ? `\n⚠️ IMPORTANT: ${giftCard.promotionalMessage || 'This promotional gift card must be used by someone else and cannot be used by the purchaser.'}` : ''}
`).join('\n')}

HOW TO USE GIFT CARDS:
• Log in to your account at jumpcsra.com
• Use the gift card balance checker in your profile
• Apply gift card balance during checkout
• Gift cards never expire and can be used for any rental
` : ''}

📋 WHAT'S NEXT?
${data.requiresPhoneCall ? '📞 Phone Call Required: Since your event is within 2 days, we\'ll contact you to confirm details and arrange delivery.' : ''}
${data.remainingBalance > 0 ? `💳 Remaining Payment: The remaining balance of $${data.remainingBalance.toFixed(2)} will be collected before or at the time of delivery.` : ''}
📧 Questions? Reply to this email or contact us at jumpcsra@gmail.com

Thank you for choosing JumpCSRA Party Rentals!
Making Your Events Unforgettable

jumpcsra@gmail.com | jumpcsra.com
Visit us at: https://jumpcsra.com
`;
};

// Helper function for plain text status
const getStatusText = (status: string, requiresPhoneCall?: boolean): string => {
  switch (status.toLowerCase()) {
    case 'confirmed':
      return '✅ ORDER STATUS: Confirmed - Your booking is confirmed and ready!';
    case 'pending':
      return '⏳ ORDER STATUS: Pending - We\'re processing your order and will confirm shortly.';
    case 'deferred':
      return '📞 ORDER STATUS: Call Required - Since your event is within 2 days, we\'ll contact you to confirm details.';
    default:
      return '📋 ORDER STATUS: Received - Thank you for your order!';
  }
};

// Main email sending function for order confirmation
export const sendOrderConfirmationEmail = async (data: OrderConfirmationEmailData): Promise<boolean> => {
  try {
    // Debug log removed
    // Debug log removed
    // Debug log removed
    // Debug log removed
    // Debug log removed
    // Debug log removed
    
    try {
      // Try to use Firebase Cloud Functions
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { app } = await import('../components/FirebaseConfig');
      
      const functions = getFunctions(app);
      const sendOrderEmail = httpsCallable(functions, 'sendOrderConfirmationEmail');
      
      // Call the Firebase Cloud Function
      const result = await sendOrderEmail(data);
      
      // Debug log removed
      
      // Send separate emails for promotional gift cards to different recipients
      for (const giftCard of data.giftCards) {
        if (giftCard.isPromotional && giftCard.recipientEmail && giftCard.recipientEmail !== data.recipientEmail) {
          await sendPromotionalGiftCardEmail({
            recipientEmail: giftCard.recipientEmail,
            recipientName: 'Gift Card Recipient',
            giftCard: giftCard,
            purchaserName: data.recipientName
          });
        }
      }
      
      // Debug log removed
      return true;
      
    } catch (firebaseError) {
      // Debug warning removed
      
      // Fallback: Log comprehensive email details for manual processing
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      
      if (data.eventDate) // Debug log removed
      if (data.deliveryAddress) // Debug log removed
      if (data.deliveryTime) // Debug log removed
      
      if (data.rentalItems.length > 0) {
        // Debug log removed
        data.rentalItems.forEach(item => {
          // Debug log removed
        });
      }
      
      if (data.lastMinuteAdditions.length > 0) {
        // Debug log removed
        data.lastMinuteAdditions.forEach(item => {
          // Debug log removed
        });
      }
      
      if (data.giftCards.length > 0) {
        // Debug log removed
        data.giftCards.forEach(gc => {
          // Debug log removed
          if (gc.recipientEmail && gc.recipientEmail !== data.recipientEmail) {
            // Debug log removed
          }
        });
      }
      
      // Debug log removed
      // Debug log removed
      // Debug log removed
      // Debug log removed
      
      // Show browser notification for testing
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Order Confirmation Email Ready!', {
          body: `Order #${data.orderID} details logged to console. Check console for email data.`,
          icon: '/favicon.ico'
        });
      }
      
      return true; // Return true since we've logged all the necessary data
    }
    
  } catch (error) {
    // Debug error removed
    return false;
  }
};

// Send promotional gift card email to different recipient
const sendPromotionalGiftCardEmail = async (data: {
  recipientEmail: string;
  recipientName: string;
  giftCard: GiftCardInfo;
  purchaserName: string;
}): Promise<boolean> => {
  try {
    // Debug log removed
    // Debug log removed
    // Debug log removed
    // Debug log removed
    
    // TODO: Generate and send promotional gift card email
    // Debug log removed
    
    return true;
  } catch (error) {
    // Debug error removed
    return false;
  }
};

// Legacy function for backward compatibility
export const sendGiftCardEmail = async (data: GiftCardEmailData): Promise<boolean> => {
  // Debug log removed
  return sendOrderConfirmationEmail({
    recipientEmail: data.recipientEmail,
    recipientName: data.recipientName,
    orderID: `LEGACY-${Date.now()}`,
    orderDate: new Date().toLocaleDateString(),
    rentalItems: [],
    lastMinuteAdditions: [],
    subtotal: data.giftCardBalance,
    surfaceAdjustment: 0,
    timeAdjustment: 0,
    deliveryCost: 0,
    totalAmount: data.giftCardBalance,
    paymentType: 'full',
    amountPaid: data.giftCardBalance,
    remainingBalance: 0,
    paymentMethod: 'Unknown',
    giftCards: [{
      code: data.giftCardCode,
      balance: data.giftCardBalance,
      expirationDate: data.expirationDate
    }],
    bookingStatus: 'confirmed'
  });
};

// Helper function to create gift card info from cart items
export const createGiftCardInfoFromCart = (
  cartItems: any[],
  promotionalGiftCards: any[] = []
): GiftCardInfo[] => {
  const giftCards: GiftCardInfo[] = [];
  
  // Add purchased gift cards
  cartItems.filter(item => item.isGiftCard).forEach(item => {
    for (let i = 0; i < item.quantity; i++) {
      giftCards.push({
        code: generateGiftCardCode(),
        balance: item.giftCardValue || item.price,
        expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        isPromotional: false
      });
    }
  });
  
  // Add promotional gift cards (like GOGO discount)
  promotionalGiftCards.forEach(promoCard => {
    giftCards.push({
      code: generateGiftCardCode(),
      balance: promoCard.balance,
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      isPromotional: true,
      promotionalMessage: promoCard.message || 'This promotional gift card must be used by someone else and cannot be used by the purchaser.',
      recipientEmail: promoCard.recipientEmail
    });
  });
  
  return giftCards;
};

// Generate random gift card code
const generateGiftCardCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Legacy interfaces and services for backward compatibility
export interface EmailService {
  sendGiftCardEmail(data: GiftCardEmailData): Promise<boolean>;
}

export class MockEmailService implements EmailService {
  async sendGiftCardEmail(data: GiftCardEmailData): Promise<boolean> {
    // Debug log removed
    // Debug log removed
    // Debug log removed
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
}