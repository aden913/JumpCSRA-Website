module.exports = {
  apps: [
    {
      name: 'jumpcsra-server',
      script: './serverFiles/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        SENDGRID_API_KEY: 'your-sendgrid-api-key',
        FIREBASE_PROJECT_ID: 'your-firebase-project-id'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};