/**
 * Email Service using SendGrid
 * Handles all email sending functionality
 */

const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  logger.info('SendGrid initialized successfully');
} else {
  logger.error('SENDGRID_API_KEY not found in environment variables');
}

// Email templates
const EMAIL_TEMPLATES = {
  'account-created': {
    subject: 'Welcome to JumpCSRA!',
    getHtml: (data) => `
      <h2>Welcome ${data.customerName}!</h2>
      <p>Thank you for creating an account with JumpCSRA. We're excited to help make your events amazing!</p>
      <p>You can now browse our inflatable rentals and book your next event.</p>
      <p>Best regards,<br>The JumpCSRA Team</p>
    `
  },
  
  'cart-reminder': {
    subject: 'Don\'t forget your items!',
    getHtml: (data) => `
      <h2>Hi ${data.customerName},</h2>
      <p>You have items waiting in your cart:</p>
      <ul>
        ${data.cartItems.map(item => `<li>${item.name} - $${item.price}</li>`).join('')}
      </ul>
      <p><strong>Total: $${data.cartTotal}</strong></p>
      <p>Complete your booking before these items are reserved by someone else!</p>
      <p>Best regards,<br>The JumpCSRA Team</p>
    `
  },
  
  'payment-confirmation': {
    subject: 'Payment Confirmation - Booking #{{bookingId}}',
    getHtml: (data) => `
      <h2>Payment Confirmed!</h2>
      <p>Hi ${data.customerName},</p>
      <p>We've received your payment of $${data.paymentAmount} for booking #${data.bookingId}.</p>
      ${data.bookingDetails ? `
        <h3>Booking Details:</h3>
        <p><strong>Event Date:</strong> ${new Date(data.bookingDetails.eventDate).toLocaleDateString()}</p>
        <p><strong>Items:</strong></p>
        <ul>
          ${data.bookingDetails.items.map(item => `<li>${item.name} - $${item.price}</li>`).join('')}
        </ul>
        <p><strong>Total:</strong> $${data.bookingDetails.total}</p>
        <p><strong>Amount Paid:</strong> $${data.bookingDetails.amountPaid}</p>
        ${data.bookingDetails.remainingBalance > 0 ? 
          `<p><strong>Remaining Balance:</strong> $${data.bookingDetails.remainingBalance}</p>` : 
          '<p><strong>Paid in Full!</strong></p>'
        }
      ` : ''}
      <p>Thank you for your business!</p>
      <p>Best regards,<br>The JumpCSRA Team</p>
    `
  },
  
  'deposit-reminder': {
    subject: 'Payment Reminder - Booking #{{bookingId}}',
    getHtml: (data) => `
      <h2>Payment Reminder</h2>
      <p>Hi ${data.customerName},</p>
      <p>This is a friendly reminder that you have a remaining balance of $${data.remainingAmount} for booking #${data.bookingId}.</p>
      ${data.dueDate ? `<p><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleDateString()}</p>` : ''}
      <p>Please complete your payment to ensure your booking is confirmed.</p>
      <p>Best regards,<br>The JumpCSRA Team</p>
    `
  },
  
  'booking-confirmation': {
    subject: 'Event Reminder - 2 Days to Go!',
    getHtml: (data) => `
      <h2>Your Event is Almost Here!</h2>
      <p>Hi ${data.customerName},</p>
      <p>Just a reminder that your event is in 2 days on ${new Date(data.eventDate).toLocaleDateString()}.</p>
      <p><strong>Booking #:</strong> ${data.bookingId}</p>
      ${data.bookingDetails ? `
        <h3>Event Details:</h3>
        <p><strong>Setup Time:</strong> ${data.bookingDetails.setupTime || 'TBD'}</p>
        <p><strong>Pickup Time:</strong> ${data.bookingDetails.pickupTime || 'TBD'}</p>
        <p><strong>Address:</strong> ${data.bookingDetails.address || 'TBD'}</p>
        <p><strong>Items:</strong></p>
        <ul>
          ${data.bookingDetails.items.map(item => `<li>${item.name}</li>`).join('')}
        </ul>
      ` : ''}
      <p>We're excited to help make your event amazing!</p>
      <p>Best regards,<br>The JumpCSRA Team</p>
    `
  },
  
  'post-event-thanks': {
    subject: 'Thank You for Choosing JumpCSRA!',
    getHtml: (data) => `
      <h2>Thank You!</h2>
      <p>Hi ${data.customerName},</p>
      <p>We hope you had an amazing event! Thank you for choosing JumpCSRA for your celebration.</p>
      <p>We'd love to hear about your experience and see photos from your event.</p>
      <p>Remember us for your next celebration - we're always here to help make your events unforgettable!</p>
      <p>Best regards,<br>The JumpCSRA Team</p>
    `
  },
  
  'follow-up': {
    subject: 'Ready for Another Amazing Event?',
    getHtml: (data) => `
      <h2>It's Been a While!</h2>
      <p>Hi ${data.customerName},</p>
      <p>It's been 9 months since your last event with us, and we miss you!</p>
      <p>Planning another celebration? We have new inflatables and great deals waiting for you.</p>
      <p>Book now and let's make your next event even more amazing than the last!</p>
      <p>Best regards,<br>The JumpCSRA Team</p>
    `
  }
};

/**
 * Send email using SendGrid
 */
async function sendEmail(templateType, data) {
  try {
    const template = EMAIL_TEMPLATES[templateType];
    if (!template) {
      throw new Error(`Unknown email template: ${templateType}`);
    }

    const emailData = {
      to: data.customerEmail,
      from: 'jumpcsra@gmail.com', // Verified sender email in SendGrid
      subject: template.subject.replace('{{bookingId}}', data.bookingId || ''),
      html: template.getHtml(data),
      text: template.getHtml(data).replace(/<[^>]*>/g, ''), // Strip HTML for text version
    };

    logger.info(`Sending ${templateType} email to ${data.customerEmail}`);
    
    const response = await sgMail.send(emailData);
    
    logger.info(`Email sent successfully: ${response[0].headers['x-message-id']}`);
    
    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
      statusCode: response[0].statusCode
    };

  } catch (error) {
    logger.error(`Error sending ${templateType} email:`, error);
    
    // Return mock response on error to prevent breaking the API
    return {
      success: false,
      error: error.message,
      messageId: `error_${Date.now()}`,
      mock: true
    };
  }
}

module.exports = {
  sendEmail
};