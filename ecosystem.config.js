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
      PORT: 3000
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
