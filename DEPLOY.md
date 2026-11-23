# 部署到服务器 & 手机当 App 用

面向腾讯云轻量应用服务器（OpenCloudOS / CentOS 系）。全程约 10 分钟。

---

## 一、先想清楚：用 HTTP 还是 HTTPS？

| 方式 | 网址 | 苹果手机 | 安卓手机 | 安全 | 门槛 |
|------|------|----------|----------|------|------|
| **HTTP（直接用 IP）** | `http://YOUR_SERVER_IP` | ✅ 加到主屏幕、全屏，像 App | ⚠️ 能加到桌面，但点开是浏览器 | 密码明文传输 | 立刻可用 |
| **HTTPS（绑域名）** | `https://你的域名` | ✅ 完整 App 体验 | ✅ 可"安装应用"、全屏 | 加密 | 需域名 + **备案**（国内约 1-2 周） |

> 国内服务器绑域名必须**备案**（在腾讯云申请，免费但要时间）。用 IP 直连不用备案，可以先跑起来用着，之后再升级 HTTPS。

下面先讲 **HTTP 快速上线**，HTTPS 升级在最后。

---

## 二、HTTP 快速上线

### 1. 准备服务器环境（只做一次）

SSH 登录服务器后，把项目传上去（见下一步），然后：

```bash
sudo bash deploy/setup-server.sh     # 装 Node 22 + pm2，放行系统防火墙
```

### 2. 上传代码

在**本机**项目目录执行（排除依赖和数据，传完在服务器装依赖）：

```bash
rsync -az --delete --exclude node_modules --exclude data --exclude .git \
  ./ root@YOUR_SERVER_IP:/opt/zhulaicai-ledger/
```

### 3. 配置账号密码

在**服务器** `/opt/zhulaicai-ledger/` 下新建 `.env`：

```ini
PORT=80
COOKIE_SECURE=false          # ⚠️ HTTP 必须设 false，否则手机存不住登录状态
LEDGER_USERNAME=zhulaicai
LEDGER_PASSWORD=换成你自己的密码
```

### 4. 装依赖并启动（长期运行）

```bash
cd /opt/zhulaicai-ledger
npm install --omit=dev
pm2 start ecosystem.config.cjs    # 启动，崩溃自动重启
pm2 save                          # 记住进程列表
pm2 startup                       # 按提示再执行一行命令 → 开机自启
```

### 5. 放行端口（两道防火墙都要开）

1. **腾讯云控制台** → 轻量应用服务器 → 防火墙 → 添加规则 → 放行 **TCP 80**
2. 系统防火墙：`setup-server.sh` 已自动处理（firewalld）

### 6. 验证

手机或电脑浏览器打开 **http://YOUR_SERVER_IP** ，用上面的账号登录即可。

---

## 三、手机当 App 用（加到主屏幕）

部署好后，把网址发给店员，各自在手机上操作一次：

**苹果（iPhone / Safari）**
1. Safari 打开网址 → 底部「分享」按钮 􀈂
2. 选「添加到主屏幕」→ 完成
3. 桌面出现「记账」图标，点开全屏运行，跟 App 一样

**安卓（Chrome / 浏览器）**
1. 打开网址 → 右上角菜单「⋮」
2. 选「添加到主屏幕」/「安装应用」→ 完成
3. （HTTPS 下会是完整的"安装应用"，全屏；HTTP 下是桌面快捷方式）

---

## 四、日常运维

```bash
pm2 status                 # 看运行状态
pm2 logs zhulaicai-ledger  # 看日志
pm2 restart zhulaicai-ledger
```

**更新代码**：本机改完 → 重新 `rsync`（第 2 步）→ 服务器 `pm2 restart zhulaicai-ledger`。

**数据备份**：账目都在 `/opt/zhulaicai-ledger/data/ledger.db`。定期拷走即可：
```bash
sqlite3 data/ledger.db ".backup data/backup-$(date +%F).db"
```

---

## 五、升级到 HTTPS（绑域名，可选，体验最佳）

1. 买域名（约￥30/年），在腾讯云完成**备案**（解析到 YOUR_SERVER_IP）。
2. 装 Caddy（自动申请并续期免费证书，最省心）：
   ```bash
   dnf install -y caddy   # 或参考 caddyserver.com 官方安装
   ```
3. 配置 `/etc/caddy/Caddyfile`（把 `记账.你的域名` 换成实际域名）：
   ```
   记账.你的域名 {
       reverse_proxy 127.0.0.1:3000
   }
   ```
4. 改 `.env`：`PORT=3000`、`COOKIE_SECURE=true`、`TRUST_PROXY=true`，然后 `pm2 restart zhulaicai-ledger`。
5. 重载 Caddy：`systemctl reload caddy`。腾讯云防火墙放行 **443**。

之后访问 `https://记账.你的域名`，苹果安卓都能完整"安装"成 App。

---

## 六、安卓 App（APK）

`android-app/` 是一个把网页包起来的 WebView 壳。打包：

```bash
bash android-app/build-apk.sh      # 生成 android-app/zhulaicai-ledger.apk
```

依赖（一次性，macOS）：`brew install openjdk@17`、`brew install --cask android-commandlinetools`、
`sdkmanager --sdk_root=$HOME/android-sdk "platform-tools" "platforms;android-34" "build-tools;34.0.0"`。

打好的 APK 已放到服务器，店员直接下载安装：

- 下载地址：**http://YOUR_SERVER_IP/zhulaicai-ledger.apk**
- 安卓手机浏览器打开 → 下载 → 点开安装（首次需允许「未知来源/未知应用」安装；国产手机可能弹安全提示，选「继续安装」）

> ⚠️ App 里的网址（`http://YOUR_SERVER_IP`）写死在 [android-app/java/com/zhulaicai/ledger/MainActivity.java](android-app/java/com/zhulaicai/ledger/MainActivity.java)。
> **网页内容更新不用重装**（壳只是加载网页）；只有**换了服务器地址/域名**时，才需改这里的 URL → 重新 `build-apk.sh` → 重新上传替换。

上传到服务器的命令（本机）：
```bash
scp android-app/zhulaicai-ledger.apk root@YOUR_SERVER_IP:/opt/zhulaicai-ledger/public/
```

