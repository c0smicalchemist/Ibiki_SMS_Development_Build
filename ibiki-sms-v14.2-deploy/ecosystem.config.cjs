module.exports = {
  apps: [{
    name: 'ibiki-sms',
    script: 'dist/index.js',
    cwd: '/root/ibiki-sms',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: '5000',
      // DATABASE_URL will be loaded from .env file
      // PM2 will read it automatically
    },
    error_file: '/root/.pm2/logs/ibiki-sms-error.log',
    out_file: '/root/.pm2/logs/ibiki-sms-out.log',
    log_file: '/root/.pm2/logs/ibiki-sms-combined.log',
    time: true,
    merge_logs: true,
    // Force PM2 to load .env file
    env_file: '.env'
  }]
};
