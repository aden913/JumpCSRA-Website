/**
 * Local Testing Proxy Server
 * Bypasses CORS issues when testing email endpoints
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 8080;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Serve static files (including your testing dashboard)
app.use(express.static(__dirname));

// Proxy to your production email server - handle all /api routes
app.use('/api', async (req, res) => {
  try {
    const targetUrl = `http://170.187.145.7:3001${req.originalUrl}`;
    console.log(`🔄 Proxying: ${req.method} ${targetUrl}`);
    
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        ...req.headers
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });
    
    const data = await response.json();
    
    res.status(response.status).json(data);
    console.log(`✅ Response: ${response.status} ${response.statusText}`);
    
  } catch (error) {
    console.error(`❌ Proxy error:`, error.message);
    res.status(500).json({ 
      error: 'Proxy error', 
      message: error.message 
    });
  }
});

// Health check proxy
app.get('/health', async (req, res) => {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://170.187.145.7:3001/health');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Server unreachable', 
      message: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Email Testing Proxy Server running on http://localhost:${PORT}`);
  console.log(`📧 Open your browser to: http://localhost:${PORT}/email-testing-dashboard.html`);
  console.log(`🔄 Proxying requests to: http://170.187.145.7:3001`);
});

// Export for package.json
module.exports = app;