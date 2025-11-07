/**
 * Email service for JumpCSRA Cloud Functions
 * Handles all email sending operations using SendGrid
 */

import * as functions from 'firebase-functions';
import * as sgMail from '@sendgrid/mail';
import { 
  OrderConfirmationEmailData, 
  GiftCardEmailData, 
  AccountDeletionEmailData 
} from '../types/email';
import { generateEnhancedOrderEmailHTML } from '../templates/orderConfirmation';
import { generateGiftCardEmailHTML, generateGiftCardEmailText } from '../templates/giftCard';

// Initialize SendGrid with API key from environment variables
const sendGridApiKey = functions.config().sendgrid?.api_key;
if (sendGridApiKey) {
  sgMail.setApiKey(sendGridApiKey);
  console.log('📧 SendGrid API Key configured successfully');
} else {
  console.warn('⚠️ SendGrid API key not configured - emails will fail');
}

/**
 * Send order confirmation email
 */
export const sendOrderConfirmationEmail = async (data: OrderConfirmationEmailData): Promise<void> => {
  console.log('📧 ENHANCED EMAIL - Sending order confirmation email...');
  
  // SendGrid API key validation
  if (!sendGridApiKey) {
    console.error('❌ ENHANCED EMAIL - SendGrid API key not configured');
    throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
  }

  // Validate required fields
  if (!data.recipientEmail || !data.recipientName || !data.orderID) {
    console.error('❌ ENHANCED EMAIL - Missing required fields:', {
      hasEmail: !!data.recipientEmail,
      hasName: !!data.recipientName,
      hasOrderID: !!data.orderID
    });
    throw new functions.https.HttpsError('invalid-argument', 'Missing required email fields.');
  }

  console.log('📧 ENHANCED EMAIL - SendGrid API Key configured:', !!sendGridApiKey);
  console.log('📧 ENHANCED EMAIL - Recipient:', data.recipientEmail);

  try {
    const emailHTML = generateEnhancedOrderEmailHTML(data);
    
    const msg = {
      to: data.recipientEmail,
      from: {
        email: 'jumpcsra@gmail.com',
        name: 'JumpCSRA Party Rentals'
      },
      subject: `Order Confirmation & Invoice - JC-${data.orderID}`,
      html: emailHTML,
      categories: ['order-confirmation'],
      customArgs: {
        orderID: data.orderID,
        paymentType: data.paymentType
      }
    };

    console.log('📧 ENHANCED EMAIL - Sending email via SendGrid...');
    await sgMail.send(msg);
    console.log('✅ ENHANCED EMAIL - Order confirmation email sent successfully');
  } catch (error: any) {
    console.error('❌ ENHANCED EMAIL - Error sending email:', error);
    console.error('❌ ENHANCED EMAIL - Error details:', JSON.stringify(error, null, 2));
    
    if (error.response) {
      console.error('❌ ENHANCED EMAIL - SendGrid response:', error.response.body);
    }
    
    throw new functions.https.HttpsError('internal', `Failed to send order confirmation email: ${error.message}`);
  }
};

/**
 * Send gift card email
 */
export const sendGiftCardEmail = async (data: GiftCardEmailData): Promise<void> => {
  console.log('🎁 Sending gift card email to:', data.recipientEmail);

  // Validate input data
  if (!data.recipientEmail || !data.giftCardCode || !data.giftCardBalance) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required gift card email data.');
  }

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
  }

  try {
    const emailHTML = generateGiftCardEmailHTML(data);
    const emailText = generateGiftCardEmailText(data);

    const msg = {
      to: data.recipientEmail,
      from: {
        email: 'jumpcsra@gmail.com',
        name: 'JumpCSRA Party Rentals'
      },
      subject: data.senderName 
        ? `🎁 You've received a gift card from ${data.senderName}!`
        : '🎁 Your JumpCSRA Gift Card is Ready!',
      html: emailHTML,
      text: emailText,
      categories: ['gift-card'],
      customArgs: {
        giftCardCode: data.giftCardCode,
        orderID: data.orderID || 'direct'
      }
    };

    await sgMail.send(msg);
    console.log('✅ Gift card email sent successfully');
  } catch (error: any) {
    console.error('❌ Error sending gift card email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send gift card email.');
  }
};

/**
 * Send account deletion confirmation email
 */
export const sendAccountDeletionEmail = async (data: AccountDeletionEmailData): Promise<void> => {
  console.log('🗑️ Sending account deletion email to:', data.email);

  if (!sendGridApiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'SendGrid API key not configured.');
  }

  if (!data.email || !data.deletionDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required account deletion email data.');
  }

  try {
    const emailHTML = generateAccountDeletionEmailHTML(data);
    const emailText = generateAccountDeletionEmailText(data);

    const msg = {
      to: data.email,
      from: {
        email: 'jumpcsra@gmail.com',
        name: 'JumpCSRA Party Rentals'
      },
      subject: 'Account Deletion Confirmation - JumpCSRA',
      html: emailHTML,
      text: emailText,
      categories: ['account-deletion'],
      customArgs: {
        deletionDate: data.deletionDate,
        reason: data.reason || 'user-request'
      }
    };

    await sgMail.send(msg);
    console.log('✅ Account deletion email sent successfully');
  } catch (error: any) {
    console.error('❌ Error sending account deletion email:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send account deletion email.');
  }
};

/**
 * Generate account deletion email HTML
 */
const generateAccountDeletionEmailHTML = (data: AccountDeletionEmailData): string => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Deletion Confirmation - JumpCSRA</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                max-width: 600px; 
                margin: 0 auto; 
                padding: 20px; 
                background-color: #f5f5f5;
            }
            .container { 
                background: white; 
                border-radius: 10px; 
                overflow: hidden; 
                box-shadow: 0 0 20px rgba(0,0,0,0.1); 
            }
            .header { 
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); 
                color: white; 
                text-align: center; 
                padding: 30px; 
            }
            .content { 
                padding: 30px; 
            }
            .info-box { 
                background: #f8f9fa; 
                border-left: 4px solid #e74c3c; 
                padding: 20px; 
                margin: 20px 0; 
                border-radius: 0 5px 5px 0; 
            }
            .footer { 
                text-align: center; 
                margin-top: 30px; 
                padding-top: 20px; 
                border-top: 1px solid #ddd; 
                color: #666; 
                font-size: 14px; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🗑️ Account Deletion Confirmed</h1>
                <p>Your JumpCSRA account has been permanently deleted</p>
            </div>
            
            <div class="content">
                <p>Hello ${data.name || 'Valued Customer'},</p>
                
                <p>This email confirms that your JumpCSRA account has been permanently deleted as requested.</p>
                
                <div class="info-box">
                    <h3>Deletion Details:</h3>
                    <p><strong>Account Email:</strong> ${data.email}</p>
                    <p><strong>Deletion Date:</strong> ${formatDate(data.deletionDate)}</p>
                    ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
                </div>
                
                <p><strong>What has been deleted:</strong></p>
                <ul>
                    <li>Your account profile and personal information</li>
                    <li>Order history and booking records</li>
                    <li>Payment information and saved cards</li>
                    <li>Gift card and wallet balances</li>
                    <li>Any stored preferences or settings</li>
                </ul>
                
                <p><strong>Important Notes:</strong></p>
                <ul>
                    <li>This action cannot be undone</li>
                    <li>You will need to create a new account to place future orders</li>
                    <li>Any active gift cards have been deactivated</li>
                    <li>We retain minimal transaction records for tax and legal compliance</li>
                </ul>
                
                <p>If you deleted your account by mistake or have any questions, please contact us immediately at jumpcsra@gmail.com or (803) 221-0466.</p>
                
                <p>Thank you for being a part of the JumpCSRA community. We're sorry to see you go!</p>
            </div>
            
            <div class="footer">
                <p>JumpCSRA Party Rentals</p>
                <p>jumpcsra@gmail.com | (803) 221-0466</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Generate account deletion email plain text version
 */
const generateAccountDeletionEmailText = (data: AccountDeletionEmailData): string => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return `
Account Deletion Confirmation - JumpCSRA

Hello ${data.name || 'Valued Customer'},

This email confirms that your JumpCSRA account has been permanently deleted as requested.

DELETION DETAILS:
Account Email: ${data.email}
Deletion Date: ${formatDate(data.deletionDate)}
${data.reason ? `Reason: ${data.reason}` : ''}

WHAT HAS BEEN DELETED:
- Your account profile and personal information
- Order history and booking records
- Payment information and saved cards
- Gift card and wallet balances
- Any stored preferences or settings

IMPORTANT NOTES:
- This action cannot be undone
- You will need to create a new account to place future orders
- Any active gift cards have been deactivated
- We retain minimal transaction records for tax and legal compliance

If you deleted your account by mistake or have any questions, please contact us immediately at jumpcsra@gmail.com or (803) 221-0466.

Thank you for being a part of the JumpCSRA community. We're sorry to see you go!

JumpCSRA Party Rentals
jumpcsra@gmail.com | (803) 221-0466
  `.trim();
};