module.exports = {
  apps: [{
    name: 'ibiki-sms',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000,
      // DATABASE_URL is embedded directly - no .env file needed!
      DATABASE_URL: 'postgresql://ibiki_user:Cosmic4382@localhost:5432/ibiki_sms',
      // Session secret - generated during deployment
      SESSION_SECRET: process.env.SESSION_SECRET || 'fallback-secret-change-in-production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false
  }]
};
