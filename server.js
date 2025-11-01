const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load environment variables from .env file in the same directory
require('dotenv').config({ path: path.join(__dirname, '.env') });

const logger = require('./utils/logger');

// Debug environment variables loading
logger.info('Environment variables loaded:');
logger.info(`NODE_ENV: ${process.env.NODE_ENV}`);
logger.info(`PORT: ${process.env.PORT}`);
logger.info(`SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? 'Found (length: ' + process.env.SENDGRID_API_KEY.length + ')' : 'Missing'}`);
logger.info(`FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID || 'Missing'}`);
logger.info(`FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? 'Found' : 'Missing'}`);
logger.info(`FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? 'Found (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ')' : 'Missing'}`);

const emailRoutes = require('./routes/emailRoutes');
const schedulerService = require('./services/schedulerService');
const { initializeFirebase } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// CORS configuration - Allow requests from your frontend
app.use(cors({
  origin: [
    'http://localhost:8080',      // Local testing proxy
    'http://127.0.0.1:8080',     // Local testing proxy
    'file://',                   // Local HTML files
    'null',                      // Local HTML files
    'http://170.187.145.7',      // Your server IP
    'https://jumpcsra.com',      // Your domain
    'https://www.jumpcsra.com'   // Your www domain
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.options('*', cors());
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    service: 'jumpcsra-email-server'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'JumpCSRA Email Automation Server',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      email: '/api/email/*',
      available_routes: [
        'POST /api/email/account-created',
        'POST /api/email/cart-reminder', 
        'POST /api/email/payment-confirmation',
        'POST /api/email/deposit-reminder',
        'POST /api/email/booking-confirmation',
        'POST /api/email/post-event-thanks',
        'POST /api/email/follow-up',
        'POST /api/email/test',
        'GET /api/email/health'
      ]
    }
  });
});

// API routes - All email endpoints are handled by emailRoutes
app.use('/api/email', emailRoutes);

// 404 handler for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    message: 'This is an API server. Available endpoints: /health, /api/email/*'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Initialize services
async function startServer() {
  try {
    // Initialize Firebase (optional - server continues without it)
    const firebaseResult = await initializeFirebase();
    if (firebaseResult) {
      logger.info('Firebase initialized successfully');
    } else {
      logger.warn('Firebase initialization skipped - some features may be limited');
    }

    // Start email scheduler (will work with or without Firebase)
    schedulerService.startScheduler();
    logger.info('Email scheduler started');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`JumpCSRA Email Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Service: Email Automation API`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
