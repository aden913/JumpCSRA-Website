const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '..', 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (error) {
  // If we can't create logs directory, use system temp directory
  console.warn('Could not create logs directory, using temp directory:', error.message);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'jumpcsra-email-server' },
  transports: [
    // Always log to console in production for PM2 to capture
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Try to add file transports if possible
try {
  logger.add(new winston.transports.File({ 
    filename: path.join(logsDir, 'error.log'), 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: path.join(logsDir, 'combined.log') 
  }));
} catch (error) {
  console.warn('Could not set up file logging:', error.message);
}

module.exports = logger;