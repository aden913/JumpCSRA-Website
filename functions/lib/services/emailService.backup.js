"use strict";
/**
 * Email service for JumpCSRA Cloud Functions
 * Handles all email sending operations by calling the external email server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAccountDeletionEmail = exports.sendGiftCardEmail = exports.sendOrderConfirmationEmail = void 0;
const functions = require("firebase-functions");
// External email server configuration
const EMAIL_SERVER_BASE_URL = 'http://170.187.145.7:3001';
/**
 * Send order confirmation email via external email server
 */
const sendOrderConfirmationEmail = async (data) => {
    console.log('📧 ENHANCED EMAIL - Sending order confirmation via email server...');
    // Validate required fields
    if (!data.recipientEmail || !data.recipientName || !data.orderID) {
        console.error('❌ ENHANCED EMAIL - Missing required fields:', {
            hasEmail: !!data.recipientEmail,
            hasName: !!data.recipientName,
            hasOrderID: !!data.orderID
        });
        throw new functions.https.HttpsError('invalid-argument', 'Missing required email fields.');
    }
    console.log('📧 ENHANCED EMAIL - Calling email server at:', EMAIL_SERVER_BASE_URL);
    console.log('📧 ENHANCED EMAIL - Recipient:', data.recipientEmail);
    try {
        const response = await fetch(`${EMAIL_SERVER_BASE_URL}/send-enhanced-order-confirmation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ ENHANCED EMAIL - Email server error:', response.status, errorText);
            throw new Error(`Email server error: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
        console.log('✅ ENHANCED EMAIL - Email server response:', result);
        console.log('✅ ENHANCED EMAIL - Order confirmation email sent successfully via email server');
    }
    catch (error) {
        console.error('❌ ENHANCED EMAIL - Error calling email server:', error);
        throw new functions.https.HttpsError('internal', `Failed to send order confirmation email: ${error.message}`);
    }
};
exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
/**
 * Send gift card email
 */
const sendGiftCardEmail = async (data) => {
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
    }
    catch (error) {
        console.error('❌ Error sending gift card email:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send gift card email.');
    }
};
exports.sendGiftCardEmail = sendGiftCardEmail;
/**
 * Send account deletion confirmation email
 */
const sendAccountDeletionEmail = async (data) => {
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
    }
    catch (error) {
        console.error('❌ Error sending account deletion email:', error);
        throw new functions.https.HttpsError('internal', 'Failed to send account deletion email.');
    }
};
exports.sendAccountDeletionEmail = sendAccountDeletionEmail;
/**
 * Generate account deletion email HTML
 */
const generateAccountDeletionEmailHTML = (data) => {
    const formatDate = (dateString) => {
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
const generateAccountDeletionEmailText = (data) => {
    const formatDate = (dateString) => {
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
//# sourceMappingURL=emailService.backup.js.map