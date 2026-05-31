#!/bin/bash
# ============================================
# 设置定时任务 - 自动备份数据库
# 使用方法: sudo ./setup-cron.sh
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 检查是否以root运行
if [ "$EUID" -ne 0 ]; then 
    log_warn "请使用 sudo 运行此脚本"
    exit 1
fi

log_info "设置定时任务 - 每日自动备份数据库..."

# 确保备份脚本可执行
chmod +x "$BACKUP_SCRIPT"

# 添加cron任务 (每天凌晨2点备份)
CRON_LINE="0 2 * * * $BACKUP_SCRIPT"

# 检查是否已存在
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    log_warn "定时任务已存在，跳过"
else
    # 添加新的cron任务
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    log_info "定时任务已添加: 每天凌晨2点备份数据库"
fi

# 显示当前cron任务
log_info "当前定时任务:"
crontab -l | grep "$BACKUP_SCRIPT" || log_warn "未找到定时任务"

log_info "设置完成！"
echo ""
log_info "手动备份命令: $BACKUP_SCRIPT"
log_info "查看备份: ls -lh /var/www/stock-management/backups/"
