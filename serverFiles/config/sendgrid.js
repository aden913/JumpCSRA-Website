const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (emailData) => {
  try {
    const msg = {
      to: emailData.to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL,
        name: process.env.SENDGRID_FROM_NAME
      },
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text || undefined,
      attachments: emailData.attachments || undefined
    };

    const result = await sgMail.send(msg);
    logger.info(`Email sent successfully to ${emailData.to}: ${emailData.subject}`);
    
    return {
      success: true,
      messageId: result[0].headers['x-message-id'],
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('SendGrid email error:', error);
    
    // Handle specific SendGrid errors
    if (error.response) {
      const { message, code, response } = error;
      return {
        success: false,
        error: {
          message,
          code,
          statusCode: response?.statusCode,
          body: response?.body
        }
      };
    }
    
    return {
      success: false,
      error: {
        message: error.message || 'Unknown email error',
        code: 'UNKNOWN_ERROR'
      }
    };
  }
};

const validateEmailAddress = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  sendEmail,
  validateEmailAddress
};