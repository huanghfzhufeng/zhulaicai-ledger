// pm2 进程配置：长期运行、崩溃自动重启、开机自启。
// 敏感信息（LEDGER_PASSWORD、PORT、COOKIE_SECURE 等）放在同目录的 .env 里，
// 由 --env-file-if-exists 加载，不要写进本文件、也不要提交到 git。
module.exports = {
  apps: [
    {
      name: 'zhulaicai-ledger',
      script: 'src/server.js',
      cwd: __dirname,
      // fork 模式（不是 cluster）——cluster 模式不会把 node_args 传给子进程，
      // 会导致 --env-file 不生效、.env 读不到。fork 模式才能正确加载 .env。
      exec_mode: 'fork',
      instances: 1,
      node_args: '--env-file-if-exists=.env',
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
