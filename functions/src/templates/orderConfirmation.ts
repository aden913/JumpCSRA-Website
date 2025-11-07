/**
 * Email template generation functions for JumpCSRA
 */

import { OrderConfirmationEmailData } from '../types/email';

/**
 * Generate enhanced order confirmation email HTML
 */
export const generateEnhancedOrderEmailHTML = (data: OrderConfirmationEmailData): string => {
  const hasRentals = data.rentalItems.length > 0;
  const hasGiftCards = data.giftCards && data.giftCards.length > 0;
  
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
        statusMessage = "⏳ Booking Pending - We'll review and confirm your order soon.";
        break;
      case 'requires_call':
        statusClass = 'status-deferred';
        statusMessage = "📞 Call Required - Since your event is within 2 days, we'll contact you to confirm details.";
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
            ${getStatusBanner(data.bookingStatus || 'confirmed', false)}
            
            ${data.eventDate ? `
            <div class="section">
                <h3>📅 Event Details</h3>
                <p><strong>Event Date:</strong> ${new Date(data.eventDate).toLocaleDateString()}</p>
                ${data.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${data.deliveryAddress}</p>` : ''}
                ${data.deliveryTime ? `<p><strong>Setup Time:</strong> ${data.deliveryTime}</p>` : ''}
                ${data.duration ? `<p><strong>Duration:</strong> ${data.duration}</p>` : ''}
                ${data.surface ? `<p><strong>Surface:</strong> ${data.surface}</p>` : ''}
            </div>
            ` : ''}
            
            ${hasRentals ? `
            <div class="section">
                <h3>🎪 Rental Items</h3>
                <ul class="item-list">
                    ${data.rentalItems.map(item => `
                        <li>
                            <div>
                                <strong>${item.name}</strong>
                                ${item.duration ? `<br><small>Duration: ${item.duration}</small>` : ''}
                                ${item.wetDry ? `<br><small>${item.wetDry}</small>` : ''}
                            </div>
                            <div style="text-align: right;">
                                <div>Qty: ${item.quantity}</div>
                                <div><strong>$${item.price.toFixed(2)}</strong></div>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
            
            ${data.lastMinuteAdditions.length > 0 ? `
            <div class="section">
                <h3>⚡ Last Minute Additions</h3>
                <ul class="item-list">
                    ${data.lastMinuteAdditions.map(item => `
                        <li>
                            <div><strong>${item.name}</strong></div>
                            <div style="text-align: right;">
                                <div>Qty: ${item.quantity}</div>
                                <div><strong>$${item.price.toFixed(2)}</strong></div>
                            </div>
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
            
            <div class="total-section">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>$${data.subtotal.toFixed(2)}</span>
                </div>
                ${data.surfaceAdjustment !== 0 ? `
                <div class="total-row">
                    <span>Surface Adjustment:</span>
                    <span>$${data.surfaceAdjustment.toFixed(2)}</span>
                </div>
                ` : ''}
                ${data.timeAdjustment !== 0 ? `
                <div class="total-row">
                    <span>Time Adjustment:</span>
                    <span>$${data.timeAdjustment.toFixed(2)}</span>
                </div>
                ` : ''}
                ${data.deliveryCost !== 0 ? `
                <div class="total-row">
                    <span>Delivery Cost:</span>
                    <span>$${data.deliveryCost.toFixed(2)}</span>
                </div>
                ` : ''}
                ${data.salesTax ? `
                <div class="total-row">
                    <span>Sales Tax:</span>
                    <span>$${data.salesTax.toFixed(2)}</span>
                </div>
                ` : ''}
                <div class="total-row grand-total">
                    <span>Total Amount:</span>
                    <span>$${data.totalAmount.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="section">
                <h3>💳 Payment Information</h3>
                <p><strong>Payment Type:</strong> ${data.paymentType === 'full' ? 'Full Payment' : 'Deposit Payment'}</p>
                <p><strong>Amount Paid:</strong> $${data.amountPaid.toFixed(2)}</p>
                ${data.remainingBalance > 0 ? `
                <p><strong>Remaining Balance:</strong> $${data.remainingBalance.toFixed(2)}</p>
                <p style="background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107;">
                    <strong>⚠️ Payment Reminder:</strong> The remaining balance of $${data.remainingBalance.toFixed(2)} is due before your event.
                </p>
                ` : `
                <p style="background: #d4edda; padding: 10px; border-radius: 5px; border-left: 4px solid #28a745;">
                    <strong>✅ Paid in Full:</strong> Thank you! Your order is fully paid.
                </p>
                `}
                ${data.paymentMethod ? `<p><strong>Payment Method:</strong> ${data.paymentMethod}</p>` : ''}
            </div>
            
            ${hasGiftCards ? `
            <div class="section">
                <h3>🎁 Gift Cards Included</h3>
                ${data.giftCards!.map(giftCard => `
                    <div class="gift-card ${giftCard.isPromotional ? 'promotional' : ''}">
                        <h4>${giftCard.isPromotional ? '🎊 Promotional Gift Card' : '🎁 Gift Card'}</h4>
                        <div class="gift-card-code">${giftCard.code}</div>
                        <div class="gift-card-balance">$${giftCard.balance.toFixed(2)}</div>
                        <p>Expires: ${new Date(giftCard.expirationDate).toLocaleDateString()}</p>
                        ${giftCard.isPromotional && giftCard.promotionalMessage ? `
                        <p style="font-style: italic; margin-top: 15px;">${giftCard.promotionalMessage}</p>
                        ` : ''}
                        ${giftCard.recipientEmail ? `
                        <p><strong>Recipient:</strong> ${giftCard.recipientEmail}</p>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${data.notes ? `
            <div class="section">
                <h3>📝 Additional Notes</h3>
                <p>${data.notes}</p>
            </div>
            ` : ''}
            
            <div class="footer">
                <p><strong>Thank you for choosing JumpCSRA Party Rentals!</strong></p>
                <p>Questions? Contact us at jumpcsra@gmail.com or (803) 221-0466</p>
                <p>Visit us online: <a href="https://jumpcsra.com">jumpcsra.com</a></p>
            </div>
        </div>
        
        <div class="company-info">
            <p><strong>JumpCSRA Party Rentals</strong><br>
            Making your events unforgettable since 2020<br>
            jumpcsra@gmail.com | (803) 221-0466</p>
        </div>
    </div>
</body>
</html>`;
};