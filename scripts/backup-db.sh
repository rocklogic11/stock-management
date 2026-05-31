#!/bin/bash
# ============================================
# 数据库备份脚本
# 使用方法: ./backup-db.sh [mysql|sqlite]
# ============================================

set -e

# 配置
BACKUP_DIR="/var/www/stock-management/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7  # 保留7天的备份

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 读取数据库配置
cd /var/www/stock-management/server
source .env.production

DB_DIALECT=${DB_DIALECT:-mysql}

if [ "$1" = "sqlite" ] || [ "$DB_DIALECT" = "sqlite" ]; then
    log_info "备份SQLite数据库..."
    SQLITE_DB="data/kuwanyubeiqi.db"
    if [ -f "$SQLITE_DB" ]; then
        cp "$SQLITE_DB" "${BACKUP_DIR}/kuwanyubeiqi_${DATE}.db"
        log_info "备份完成: ${BACKUP_DIR}/kuwanyubeiqi_${DATE}.db"
    else
        log_warn "数据库文件不存在: $SQLITE_DB"
        exit 1
    fi
else
    log_info "备份MySQL数据库..."
    mysqldump -h ${DB_HOST:-localhost} -P ${DB_PORT:-3306} \
        -u ${DB_USER:-root} -p${DB_PASSWORD} \
        --single-transaction --routines --triggers \
        ${DB_NAME:-kuwanyubeiqi_prod} | gzip > "${BACKUP_DIR}/kuwanyubeiqi_${DATE}.sql.gz"
    log_info "备份完成: ${BACKUP_DIR}/kuwanyubeiqi_${DATE}.sql.gz"
fi

# 删除旧备份
log_info "清理 ${RETENTION_DAYS} 天前的备份..."
find ${BACKUP_DIR} -name "kuwanyubeiqi_*.db" -mtime +${RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "kuwanyubeiqi_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

log_info "备份任务完成！"
log_info "备份位置: ${BACKUP_DIR}"
ls -lh ${BACKUP_DIR} | tail -n 10
