const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

// Initialize SendGrid with validation
let sendGridInitialized = false;

const initializeSendGrid = () => {
  const apiKey = process.env.SENDGRID_API_KEY;
  
  if (!apiKey) {
    logger.warn('SENDGRID_API_KEY not found in environment variables');
    logger.warn('Email functionality will be disabled');
    return false;
  }

  if (!apiKey.startsWith('SG.')) {
    logger.warn('Invalid SendGrid API key format - should start with "SG."');
    logger.warn('Email functionality will be disabled');
    return false;
  }

  try {
    sgMail.setApiKey(apiKey);
    sendGridInitialized = true;
    logger.info('SendGrid initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize SendGrid:', error);
    return false;
  }
};

// Initialize on startup
initializeSendGrid();

const sendEmail = async (emailData) => {
  if (!sendGridInitialized) {
    logger.warn('SendGrid not initialized - email will be skipped');
    return {
      success: false,
      error: {
        message: 'SendGrid not configured',
        code: 'SENDGRID_NOT_INITIALIZED'
      }
    };
  }

  try {
    const msg = {
      to: emailData.to,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@jumpcsra.com',
        name: process.env.SENDGRID_FROM_NAME || 'JumpCSRA'
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