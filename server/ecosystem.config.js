module.exports = {
  apps: [
    {
      name: 'kuwanyubeiqi-server',
      script: './src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // 自动重启配置
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // 日志配置
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      
      // 优雅关闭
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // 重启策略
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
