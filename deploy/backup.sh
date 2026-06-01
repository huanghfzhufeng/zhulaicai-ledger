#!/usr/bin/env bash
# 每日备份 SQLite 数据库，自动保留最近 14 天。
# 建议加到 crontab（每天凌晨 4 点）：
#   0 4 * * * /opt/zhulaicai-ledger/deploy/backup.sh >> /opt/zhulaicai-ledger/data/backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."   # 切到项目根目录

DB="${DB_PATH:-data/ledger.db}"
OUT="data/backups"
mkdir -p "$OUT"
STAMP="$(date +%F)"
DEST="$OUT/ledger-$STAMP.db"

# sqlite3 的 .backup 是在线一致性备份（含 WAL），不会锁坏正在运行的应用
sqlite3 "$DB" ".backup '$DEST'"

# 只保留最近 14 天
find "$OUT" -name 'ledger-*.db' -mtime +14 -delete 2>/dev/null || true

echo "$(date '+%F %T') 备份完成 -> $DEST ($(du -h "$DEST" | cut -f1))"
