#!/usr/bin/env bash
# 在服务器上运行一次，准备运行环境：安装 Node.js 22 + pm2，放行系统防火墙端口。
# 适用于 OpenCloudOS / TencentOS / CentOS / RHEL 系（dnf / yum）。
#   用法： sudo bash deploy/setup-server.sh
set -euo pipefail

PORT="${PORT:-80}"

need_node() {
  command -v node >/dev/null 2>&1 || return 0
  [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 20 ]
}

if need_node; then
  echo "==> 安装 Node.js 22 ..."
  curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
  (dnf install -y nodejs gcc-c++ make || yum install -y nodejs gcc-c++ make)
fi
echo "==> Node: $(node -v) / npm: $(npm -v)"

echo "==> 安装 pm2 ..."
npm install -g pm2

# 系统防火墙（firewalld）放行端口；腾讯云控制台的『防火墙』也要单独放行！
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  echo "==> firewalld 放行 ${PORT}/tcp ..."
  firewall-cmd --permanent --add-port="${PORT}/tcp" || true
  firewall-cmd --reload || true
fi

echo
echo "✅ 环境就绪。"
echo "⚠️  别忘了：登录腾讯云控制台 → 轻量应用服务器 → 防火墙 → 放行 TCP ${PORT} 端口。"
