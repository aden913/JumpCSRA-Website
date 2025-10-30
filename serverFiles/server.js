const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const logger = require('./utils/logger');
const emailRoutes = require('./routes/emailRoutes');
const schedulerService = require('./services/schedulerService');
const { initializeFirebase } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3001;

// Path to React build files
const buildPath = path.join(__dirname, '../JumpCSRA/build/client');

// Security middleware
app.use(helmet());
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

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://jumpcsra.com', 'https://www.jumpcsra.com', process.env.FRONTEND_URL] // Add your actual domain
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

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
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/email', emailRoutes);

// Serve static files from React build
app.use(express.static(buildPath));

// React Router v7 SSR handler
let reactRouterHandler;
try {
  // Import the React Router server build
  const serverBuild = require('../JumpCSRA/build/server/index.js');
  const { createRequestHandler } = require('@react-router/express');
  
  reactRouterHandler = createRequestHandler({
    build: serverBuild,
    mode: process.env.NODE_ENV
  });
  
  logger.info('React Router SSR handler initialized');
} catch (error) {
  logger.warn('React Router SSR not available, falling back to static serving:', error.message);
  reactRouterHandler = null;
}

// Handle React Router routes - send all non-API requests to React
app.get('*', (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'API route not found',
      path: req.originalUrl
    });
  }
  
  // Use React Router SSR if available, otherwise serve static files
  if (reactRouterHandler) {
    return reactRouterHandler(req, res, next);
  } else {
    // Fallback: serve a basic HTML shell for SPA mode
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JumpCSRA</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/assets/entry.client-DbCpDke0.js"></script>
</body>
</html>`;
    res.send(html);
  }
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
      logger.info(`JumpCSRA Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`Serving React app from: ${buildPath}`);
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