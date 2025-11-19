/**
 * PM2 生产环境配置文件
 * 用于管理 Next.js 应用的生产环境进程
 */
module.exports = {
  apps: [
    {
      name: 'react-nnnnzs-cn',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 1, // 单实例运行，如需多实例可设置为 'max' 或具体数字
      exec_mode: 'fork', // fork 模式，cluster 模式需要设置为 'cluster'
      env: {
        NODE_ENV: 'production',
        PORT: 3301, // 生产环境端口，可根据需要修改
      },
      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true, // 日志时间戳
      // 自动重启配置
      autorestart: true,
      watch: false, // 生产环境不监听文件变化
      max_memory_restart: '1G', // 内存超过 1G 自动重启
      // 进程管理
      min_uptime: '10s', // 最小运行时间
      max_restarts: 10, // 最大重启次数
      restart_delay: 4000, // 重启延迟（毫秒）
    },
  ],
};

