module.exports = {
  apps: [{
    name: 'jumpcsra-server',
    script: "build/server/index.js",
    args: './JumpCSRA/build/server/index.js',
    cwd: '/var/www/JumpCSRA-Website/JumpCSRA',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      
      // Firebase Configuration (REQUIRED)
      // These need VITE_ prefix for Vite's import.meta.env system
      VITE_FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || '',
      VITE_FIREBASE_AUTH_DOMAIN: process.env.VITE_FIREBASE_AUTH_DOMAIN || '',
      VITE_FIREBASE_DATABASE_URL: process.env.VITE_FIREBASE_DATABASE_URL || '',
      VITE_FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || '',
      VITE_FIREBASE_STORAGE_BUCKET: process.env.VITE_FIREBASE_STORAGE_BUCKET || '',
      VITE_FIREBASE_MESSAGING_SENDER_ID: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      VITE_FIREBASE_APP_ID: process.env.VITE_FIREBASE_APP_ID || '',
      
      // Optional Services
      VITE_EMAIL_API_KEY: process.env.VITE_EMAIL_API_KEY || '',
      VITE_EMAIL_SERVICE_URL: process.env.VITE_EMAIL_SERVICE_URL || '',
      VITE_GOOGLE_MAPS_API_KEY: process.env.VITE_GOOGLE_MAPS_API_KEY || '',
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
