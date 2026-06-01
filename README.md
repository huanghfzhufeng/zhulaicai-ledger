# 朱来财大排档 · 记账

一个面向大排档/小店的每日开支记账应用。原本是纯前端单页（数据存在浏览器里，换设备就丢），现已改造为**可长期运行的全栈应用**：

- 🔐 **固定账号登录** —— 内部使用，全店共用一本账（无公开注册，账号在 `.env` 配置）
- 🗄️ **SQLite 持久化** —— 数据存在服务器，换手机登录同一账号即可看到
- 📱 移动端优先的记账界面：类别下拉选择、数字键盘、按天/月/年统计
- ♻️ 长期运行：优雅关闭、会话自动过期清理、WAL 模式

## 技术栈

| 层 | 选型 |
|----|------|
| 运行时 | Node.js ≥ 20（开发于 Node 25）|
| Web 框架 | Express 5 |
| 数据库 | SQLite（`better-sqlite3`，自动回退到内置 `node:sqlite`）|
| 密码 | Node 内置 `crypto.scrypt`（加盐哈希）|
| 会话 | 随机令牌存数据库（仅存哈希），重启不掉登录 |
| 前端 | 原生 HTML/CSS/ES Module，无构建步骤 |

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动
npm start
# 或开发模式（改动自动重启）
npm run dev
```

打开浏览器访问 <http://localhost:3000> ，用固定账号登录：

- 默认账号：`zhulaicai`　默认密码：`zhulaicai888`
- ⚠️ 请尽快在 `.env` 设置 `LEDGER_PASSWORD` 改成自己的密码（改完重启即生效）

账号在首次启动时自动创建。数据库文件默认生成在 `./data/ledger.db`。

## 配置

所有配置通过环境变量（可放进 `.env`，参考 [`.env.example`](.env.example)）：

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `3000` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DB_PATH` | `./data/ledger.db` | SQLite 文件路径 |
| `NODE_ENV` | `development` | `production` 时自动开启安全 Cookie |
| `COOKIE_SECURE` | 跟随 `NODE_ENV` | 仅 HTTPS 访问时设 `true` |
| `TRUST_PROXY` | `false` | 部署在 nginx/caddy 之后时设 `true` |
| `SESSION_TTL_DAYS` | `30` | 登录有效期（天）|
| `LEDGER_USERNAME` | `zhulaicai` | 固定登录账号 |
| `LEDGER_PASSWORD` | `zhulaicai888` | 固定登录密码（**务必修改**）|

> ⚠️ 通过 HTTPS 对外提供服务时，请设置 `COOKIE_SECURE=true`，否则浏览器不会保存登录状态。
>
> 🔑 改 `LEDGER_PASSWORD` 后重启会自动更新密码；改 `LEDGER_USERNAME` 会新建一个空账号（旧账号数据仍在旧用户名下）。

## 长期运行（生产部署）

### 方式一：PM2（推荐）

```bash
npm install -g pm2
NODE_ENV=production pm2 start src/server.js --name zhulaicai-ledger
pm2 save          # 保存进程列表
pm2 startup       # 生成开机自启脚本，按提示执行
```

### 方式二：systemd

新建 `/etc/systemd/system/zhulaicai-ledger.service`：

```ini
[Unit]
Description=Zhulaicai Ledger
After=network.target

[Service]
WorkingDirectory=/opt/zhulaicai-ledger
ExecStart=/usr/bin/node src/server.js
Environment=NODE_ENV=production
Environment=PORT=3000
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now zhulaicai-ledger
```

进程收到 `SIGTERM`/`SIGINT` 会优雅关闭（先停接新请求，再关数据库）。

### 数据备份

数据全部在 SQLite 文件里。定期备份 `data/` 目录即可（WAL 模式下连同 `-wal`/`-shm` 一起备份，或先停服务再拷贝）：

```bash
# 在线一致性备份
sqlite3 data/ledger.db ".backup data/backup-$(date +%F).db"
```

## 项目结构

```
src/
  server.js          启动 / 优雅关闭 / 定时清理
  app.js             Express 装配、中间件、安全头、错误处理
  config.js          环境变量配置
  db/
    index.js         数据库连接（驱动自动检测）+ PRAGMA
    schema.js        建表语句（幂等）
  auth/
    password.js      scrypt 哈希 / 校验
    sessions.js      会话令牌的创建 / 查询 / 销毁
    middleware.js    attachUser / requireAuth
    seed.js          启动时自动创建/同步固定账号
  models/
    users.js         用户数据访问
    entries.js       账目数据访问
  routes/
    auth.js          /api/auth/*
    entries.js       /api/entries/*
  lib/
    http.js          统一响应封装 + ApiError
    validation.js    输入校验
    categories.js    分类（单一数据源）
    rate-limit.js    登录限流
public/
  index.html         记账主界面
  login.html         登录页
  css/ js/           样式与前端逻辑
test/
  api.test.js        接口集成测试
```

## API 一览

所有响应统一为 `{ success, data, error }`。除标注外均需登录（Cookie 会话）。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth/login` | 登录 |
| `POST` | `/api/auth/logout` | 登出 |
| `GET` | `/api/auth/me` | 当前用户 |
| `GET` | `/api/categories` | 分类列表（公开）|
| `GET` | `/api/entries` | 全部账目 |
| `POST` | `/api/entries` | 新增一笔 `{ date, cat, amt }` |
| `DELETE` | `/api/entries/:id` | 删除一笔 |

> 内部工具，无公开注册接口；账号由 `.env` 配置并在启动时自动创建。

## 测试

```bash
npm test
```

覆盖：固定账号登录/登出、账目增删查、输入校验、未登录拦截、注册接口已下线。
