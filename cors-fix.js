// Quick CORS test for your email server
// Add this to your email server (server.js) if not already present

const cors = require('cors');

// Add this BEFORE your routes
app.use(cors({
  origin: [
    'http://localhost',
    'http://127.0.0.1',
    'file://',
    'null', // For local HTML files
    'http://170.187.145.7',
    'https://jumpcsra.com',
    'https://www.jumpcsra.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Add preflight handling
app.options('*', cors());

console.log('✅ CORS enabled for testing');