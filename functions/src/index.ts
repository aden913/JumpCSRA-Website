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