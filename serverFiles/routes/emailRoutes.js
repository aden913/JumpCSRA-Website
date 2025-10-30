const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { 
  authenticateAPI, 
  handleValidationErrors, 
  emailValidation, 
  orderValidation, 
  cartValidation, 
  bookingValidation 
} = require('../utils/validation');
const logger = require('../utils/logger');

// Account creation email
router.post('/account-creation', 
  authenticateAPI,
  emailValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { email, name, userID } = req.body;
      
      const result = await emailService.sendAccountCreationEmail({
        email,
        name,
        userID
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Account creation email error:', error);
      res.status(500).json({
        error: 'Failed to send account creation email',
        message: error.message
      });
    }
  }
);

// Order confirmation email (after payment)
router.post('/order-confirmation',
  authenticateAPI,
  orderValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await emailService.sendOrderConfirmationEmail(req.body);
      res.json(result);
    } catch (error) {
      logger.error('Order confirmation email error:', error);
      res.status(500).json({
        error: 'Failed to send order confirmation email',
        message: error.message
      });
    }
  }
);

// Cart abandonment reminder
router.post('/cart-reminder',
  authenticateAPI,
  cartValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userID, cartItems, cartValue, customerEmail, customerName } = req.body;
      
      // Schedule cart reminder for 24 hours later
      const result = await emailService.scheduleCartReminderEmail({
        userID,
        cartItems,
        cartValue,
        customerEmail,
        customerName,
        delayHours: parseInt(process.env.CART_REMINDER_DELAY_HOURS) || 24
      });
      
      res.json(result);
    } catch (error) {
      logger.error('Cart reminder scheduling error:', error);
      res.status(500).json({
        error: 'Failed to schedule cart reminder',
        message: error.message
      });
    }
  }
);

// Deposit reminder email
router.post('/deposit-reminder',
  authenticateAPI,
  bookingValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await emailService.scheduleDepositReminderEmail(req.body);
      res.json(result);
    } catch (error) {
      logger.error('Deposit reminder scheduling error:', error);
      res.status(500).json({
        error: 'Failed to schedule deposit reminder',
        message: error.message
      });
    }
  }
);

// Event confirmation (2 days before)
router.post('/event-confirmation',
  authenticateAPI,
  bookingValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await emailService.scheduleEventConfirmationEmail(req.body);
      res.json(result);
    } catch (error) {
      logger.error('Event confirmation scheduling error:', error);
      res.status(500).json({
        error: 'Failed to schedule event confirmation',
        message: error.message
      });
    }
  }
);

// Post-event thank you
router.post('/post-event-thanks',
  authenticateAPI,
  bookingValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await emailService.schedulePostEventThanksEmail(req.body);
      res.json(result);
    } catch (error) {
      logger.error('Post-event thanks scheduling error:', error);
      res.status(500).json({
        error: 'Failed to schedule post-event thanks',
        message: error.message
      });
    }
  }
);

// Rebooking reminder (9 months later)
router.post('/rebooking-reminder',
  authenticateAPI,
  bookingValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await emailService.scheduleRebookingReminderEmail(req.body);
      res.json(result);
    } catch (error) {
      logger.error('Rebooking reminder scheduling error:', error);
      res.status(500).json({
        error: 'Failed to schedule rebooking reminder',
        message: error.message
      });
    }
  }
);

// Cancel scheduled email
router.delete('/scheduled/:emailID',
  authenticateAPI,
  async (req, res) => {
    try {
      const { emailID } = req.params;
      const result = await emailService.cancelScheduledEmail(emailID);
      res.json(result);
    } catch (error) {
      logger.error('Cancel scheduled email error:', error);
      res.status(500).json({
        error: 'Failed to cancel scheduled email',
        message: error.message
      });
    }
  }
);

// Get scheduled emails for a user
router.get('/scheduled/:userID',
  authenticateAPI,
  async (req, res) => {
    try {
      const { userID } = req.params;
      const result = await emailService.getScheduledEmails(userID);
      res.json(result);
    } catch (error) {
      logger.error('Get scheduled emails error:', error);
      res.status(500).json({
        error: 'Failed to get scheduled emails',
        message: error.message
      });
    }
  }
);

// Test email endpoint (development only)
router.post('/test',
  authenticateAPI,
  async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Test endpoint not available in production'
      });
    }
    
    try {
      const { type, email } = req.body;
      const result = await emailService.sendTestEmail(type, email);
      res.json(result);
    } catch (error) {
      logger.error('Test email error:', error);
      res.status(500).json({
        error: 'Failed to send test email',
        message: error.message
      });
    }
  }
);

module.exports = router;