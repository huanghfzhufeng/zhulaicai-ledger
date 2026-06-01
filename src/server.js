import { createApp } from './app.js';
import { config } from './config.js';
import { closeDb, driverName } from './db/index.js';
import { deleteExpiredSessions } from './auth/sessions.js';
import { ensureAccounts } from './auth/seed.js';

// Make sure the preset accounts exist before we start serving requests.
const accounts = await ensureAccounts();

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`朱来财大排档 · 记账 已启动`);
  console.log(`  地址: http://${config.host}:${config.port}`);
  console.log(`  数据库: ${config.dbPath} (${driverName})`);
  console.log(`  环境: ${config.nodeEnv}`);
  console.log(`  老板账号: ${accounts.owner.username}`);
  if (accounts.staff) console.log(`  员工账号: ${accounts.staff.username}`);
  if (config.usingDefaultPassword) {
    console.log('  ⚠️  老板用默认密码 zhulaicai888，请在 .env 设置 LEDGER_PASSWORD');
  }
  if (accounts.staff && config.usingDefaultStaffPassword) {
    console.log('  ⚠️  员工用默认密码 yuangong888，请在 .env 设置 STAFF_PASSWORD');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[fatal] 端口 ${config.port} 已被占用，请用 PORT 环境变量换一个端口`);
  } else {
    console.error('[fatal] 服务器启动失败:', err);
  }
  process.exit(1);
});

// Periodically purge expired sessions. `unref` so it never keeps the process alive.
const purge = () => {
  const removed = deleteExpiredSessions();
  if (removed > 0) console.log(`[housekeeping] 清理了 ${removed} 个过期会话`);
};
purge();
const cleanupTimer = setInterval(purge, 60 * 60 * 1000);
cleanupTimer.unref();

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n收到 ${signal}，正在优雅关闭…`);
  clearInterval(cleanupTimer);

  const forceExit = setTimeout(() => {
    console.error('[shutdown] 超时，强制退出');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close((err) => {
    closeDb();
    if (err) {
      console.error('[shutdown] 关闭出错:', err);
      process.exit(1);
    }
    console.log('已关闭，再见。');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
