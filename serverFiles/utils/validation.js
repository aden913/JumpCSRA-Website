const { body, validationResult } = require('express-validator');
const logger = require('./logger');

// API Key authentication middleware
const authenticateAPI = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    logger.warn(`Unauthorized API access attempt from ${req.ip}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Valid API key required'
    });
  }
  
  next();
};

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Common validation rules
const emailValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email address required'),
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
];

const orderValidation = [
  body('orderID').isString().trim().isLength({ min: 1, max: 50 }),
  body('customerEmail').isEmail().normalizeEmail(),
  body('customerName').isString().trim().isLength({ min: 1, max: 100 }),
  body('totalAmount').isNumeric().isFloat({ min: 0 }),
];

const cartValidation = [
  body('userID').isString().trim().isLength({ min: 1, max: 50 }),
  body('cartItems').isArray({ min: 1 }),
  body('cartValue').isNumeric().isFloat({ min: 0 }),
];

const bookingValidation = [
  body('bookingID').isString().trim().isLength({ min: 1, max: 50 }),
  body('customerEmail').isEmail().normalizeEmail(),
  body('eventDate').isISO8601().toDate(),
];

module.exports = {
  authenticateAPI,
  handleValidationErrors,
  emailValidation,
  orderValidation,
  cartValidation,
  bookingValidation
};