"use strict";
/**
 * Gift card email template generation for JumpCSRA
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateGiftCardEmailText = exports.generateGiftCardEmailHTML = void 0;
/**
 * Generate gift card email HTML
 */
const generateGiftCardEmailHTML = (data) => {
    const formatDate = (dateString) => {
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
            <p>Hi ${data.recipientName || 'Valued Customer'},</p>
            
            ${data.senderName ? `<p>You've received a gift card from <strong>${data.senderName}</strong>!</p>` : '<p>Congratulations! Your gift card purchase has been confirmed.</p>'}
            
            ${data.personalMessage ? `
            <div style="background: #e3f2fd; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h4 style="margin-top: 0; color: #1976D2;">💌 Personal Message:</h4>
                <p style="font-style: italic; margin-bottom: 0;">"${data.personalMessage}"</p>
            </div>
            ` : ''}
            
            <p>Here are your gift card details:</p>
            
            <div class="gift-card-box">
                <h2>🎁 Gift Card Details</h2>
                <div class="gift-card-code">${data.giftCardCode}</div>
                <div class="balance">$${data.giftCardBalance.toFixed(2)}</div>
                <p><strong>Purchased:</strong> ${formatDate(data.purchaseDate)}</p>
                <p><strong>Expires:</strong> ${formatDate(data.expirationDate)}</p>
                ${data.orderID ? `<p><strong>Order ID:</strong> ${data.orderID}</p>` : ''}
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
exports.generateGiftCardEmailHTML = generateGiftCardEmailHTML;
/**
 * Generate gift card email plain text version
 */
const generateGiftCardEmailText = (data) => {
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
    return `
JumpCSRA Gift Card - Thank You for Your Purchase!

Hi ${data.recipientName || 'Valued Customer'},

${data.senderName ? `You've received a gift card from ${data.senderName}!` : 'Congratulations! Your gift card purchase has been confirmed.'}

${data.personalMessage ? `Personal Message: "${data.personalMessage}"` : ''}

GIFT CARD DETAILS:
Code: ${data.giftCardCode}
Balance: $${data.giftCardBalance.toFixed(2)}
Purchased: ${formatDate(data.purchaseDate)}
Expires: ${formatDate(data.expirationDate)}
${data.orderID ? `Order ID: ${data.orderID}` : ''}

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
exports.generateGiftCardEmailText = generateGiftCardEmailText;
//# sourceMappingURL=giftCard.js.map