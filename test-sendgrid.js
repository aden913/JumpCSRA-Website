/**
 * Direct SendGrid Test
 * Tests if SendGrid is working with your API key
 */

// Load environment variables
require('dotenv').config();

const sgMail = require('@sendgrid/mail');

async function testSendGrid() {
  console.log('🔍 Testing SendGrid Configuration...');
  
  // Check API key
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.log('❌ SENDGRID_API_KEY not found in environment variables');
    return;
  }
  
  console.log(`✅ SendGrid API Key found (length: ${apiKey.length})`);
  
  // Set API key
  sgMail.setApiKey(apiKey);
  
  // Test email
  const testEmail = {
    to: 'coxaden@gmail.com',
    from: 'jumpcsra@gmail.com', // Verified sender email in SendGrid
    subject: 'SendGrid Test Email',
    text: 'This is a test email from your JumpCSRA email server.',
    html: '<p>This is a <strong>test email</strong> from your JumpCSRA email server.</p>',
  };
  
  try {
    console.log('📧 Sending test email...');
    const response = await sgMail.send(testEmail);
    
    console.log('✅ Email sent successfully!');
    console.log('📧 Message ID:', response[0].headers['x-message-id']);
    console.log('📊 Status Code:', response[0].statusCode);
    
  } catch (error) {
    console.log('❌ SendGrid Error:');
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
    
    if (error.response) {
      console.log('Response Body:', error.response.body);
    }
  }
}

// Run test
testSendGrid().catch(console.error);