// Local testing script for SendGrid email functionality
// Run this with: node test-email.js

const sgMail = require('@sendgrid/mail');

// Set API key
sgMail.setApiKey('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');

// Test gift card email data
const testEmailData = {
  recipientEmail: 'coxaden@gmail.com', // Send to your email for testing
  recipientName: 'Test Customer',
  giftCardCode: 'TEST-1234-5678',
  giftCardBalance: 50.00,
  expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString() // 1 year from now
};

// Generate HTML email template
const generateGiftCardEmailHTML = (data) => {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your JumpCSRA Gift Card</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .gift-card { background: white; border: 2px dashed #667eea; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center; }
        .code { font-size: 24px; font-weight: bold; color: #667eea; letter-spacing: 2px; margin: 10px 0; }
        .balance { font-size: 36px; font-weight: bold; color: #28a745; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
        .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎉 Your JumpCSRA Gift Card!</h1>
        <p>Thank you for your purchase!</p>
    </div>
    
    <div class="content">
        <p>Hi ${data.recipientName}!</p>
        
        <p>Your JumpCSRA gift card is ready to use! Here are your gift card details:</p>
        
        <div class="gift-card">
            <h3>Gift Card Details</h3>
            <div class="code">${data.giftCardCode}</div>
            <div class="balance">$${data.giftCardBalance.toFixed(2)}</div>
            <p><strong>Expires:</strong> ${data.expirationDate}</p>
        </div>
        
        <p><strong>How to use your gift card:</strong></p>
        <ul>
            <li>Visit our website and browse our inflatable rentals</li>
            <li>Add items to your cart and proceed to checkout</li>
            <li>In your profile, use the gift card balance checker to view your balance</li>
            <li>Apply your gift card balance during payment</li>
        </ul>
        
        <p><strong>Important:</strong></p>
        <ul>
            <li>Keep this email safe - you'll need the gift card code to use your balance</li>
            <li>Gift cards do not expire and can be used for any rental</li>
            <li>You can check your balance anytime in your profile</li>
            <li>Unused balances remain on your account for future purchases</li>
        </ul>
        
        <div style="text-align: center;">
            <a href="https://jumpcsra.com" class="button">Start Shopping</a>
        </div>
        
        <p>Thank you for choosing JumpCSRA for your party rental needs!</p>
        
        <div class="footer">
            <p>Questions? Contact us at jumpcsra@gmail.com or visit our website</p>
            <p>JumpCSRA Party Rentals - Making Your Events Unforgettable!</p>
        </div>
    </div>
</body>
</html>`;
};

// Generate text version
const generateGiftCardEmailText = (data) => {
  return `
🎉 Your JumpCSRA Gift Card!

Hi ${data.recipientName}!

Thank you for your purchase! Your JumpCSRA gift card is ready to use.

GIFT CARD DETAILS:
Code: ${data.giftCardCode}
Balance: $${data.giftCardBalance.toFixed(2)}
Expires: ${data.expirationDate}

HOW TO USE YOUR GIFT CARD:
1. Visit our website and browse our inflatable rentals
2. Add items to your cart and proceed to checkout
3. In your profile, use the gift card balance checker to view your balance
4. Apply your gift card balance during payment

IMPORTANT:
- Keep this email safe - you'll need the gift card code to use your balance
- Gift cards do not expire and can be used for any rental
- You can check your balance anytime in your profile
- Unused balances remain on your account for future purchases

Start shopping: https://jumpcsra.com

Thank you for choosing JumpCSRA for your party rental needs!

Questions? Contact us at jumpcsra@gmail.com
JumpCSRA Party Rentals - Making Your Events Unforgettable!
`;
};

// Test the email sending
async function testEmail() {
  try {
    console.log('🧪 Testing SendGrid email functionality...');
    console.log('📧 Recipient:', testEmailData.recipientEmail);
    console.log('🎁 Gift Card Code:', testEmailData.giftCardCode);
    console.log('💰 Balance:', `$${testEmailData.giftCardBalance}`);
    
    const msg = {
      to: testEmailData.recipientEmail,
      from: {
        email: 'jumpcsra@gmail.com',
        name: 'JumpCSRA Party Rentals'
      },
      subject: `Your JumpCSRA Gift Card - $${testEmailData.giftCardBalance.toFixed(2)}`,
      html: generateGiftCardEmailHTML(testEmailData),
      text: generateGiftCardEmailText(testEmailData)
    };
    
    console.log('📤 Sending email...');
    const response = await sgMail.send(msg);
    
    console.log('✅ Email sent successfully!');
    console.log('📬 Response:', response[0].statusCode);
    console.log('🎉 Check your email:', testEmailData.recipientEmail);
    
  } catch (error) {
    console.error('❌ Email failed:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  }
}

// Run the test
testEmail();