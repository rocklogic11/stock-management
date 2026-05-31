#!/bin/bash
# ============================================
# 酷玩预备齐库存管理系统 - Linux部署脚本
# ============================================

set -e  # 遇到错误立即退出

echo "============================================"
echo "酷玩预备齐库存管理系统 - 生产环境部署"
echo "============================================"
echo ""

# 配置变量
APP_NAME="stock-management"
APP_DIR="/var/www/${APP_NAME}"
BACKUP_DIR="${APP_DIR}/backups"
LOG_DIR="${APP_DIR}/server/logs"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
if [ "$EUID" -eq 0 ]; then 
    log_warn "建议使用非root用户运行此脚本"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 1. 检查系统要求
log_info "步骤1: 检查系统要求..."
command -v node >/dev/null 2>&1 || { log_error "Node.js 未安装"; exit 1; }
command -v npm >/dev/null 2>&1 || { log_error "npm 未安装"; exit 1; }
command -v nginx >/dev/null 2>&1 || { log_warn "Nginx 未安装，将尝试安装"; }
log_info "Node.js $(node -v)"
log_info "npm $(npm -v)"

# 2. 创建目录结构
log_info "步骤2: 创建目录结构..."
sudo mkdir -p ${APP_DIR}
sudo mkdir -p ${BACKUP_DIR}
sudo mkdir -p ${LOG_DIR}
sudo chown -R $USER:$USER ${APP_DIR}

# 3. 部署后端
log_info "步骤3: 部署后端服务..."
cd ${APP_DIR}/server

# 安装依赖
log_info "安装后端依赖..."
npm install --production

# 创建日志目录
mkdir -p logs

# 4. 部署前端
log_info "步骤4: 构建前端..."
cd ${APP_DIR}/web

# 安装依赖
log_info "安装前端依赖..."
npm install

# 构建生产版本
log_info "构建生产版本..."
npm run build

# 5. 配置环境变量
log_info "步骤5: 配置环境变量..."
if [ ! -f ${APP_DIR}/server/.env.production ]; then
    log_warn "未找到 .env.production 文件"
    log_info "请手动创建生产环境配置文件"
    log_info "参考 .env.production 示例配置"
else
    log_info "环境变量配置文件已存在"
fi

# 6. 启动/重启PM2
log_info "步骤6: 启动后端服务..."
cd ${APP_DIR}/server

# 检查PM2是否安装
if ! command -v pm2 &> /dev/null; then
    log_info "安装PM2..."
    sudo npm install -g pm2
fi

# 启动或重启应用
if pm2 list | grep -q "kuwanyubeiqi-server"; then
    log_info "重启应用..."
    pm2 restart ecosystem.config.js --env production
else
    log_info "首次启动应用..."
    pm2 start ecosystem.config.js --env production
fi

# 保存PM2配置
pm2 save

# 7. 配置Nginx
log_info "步骤7: 配置Nginx..."
if [ -f "/etc/nginx/sites-available/stock-management" ]; then
    log_info "Nginx配置已存在，跳过"
else
    log_warn "未找到Nginx配置文件"
    log_info "请手动配置Nginx，参考 deploy/nginx.conf"
fi

# 8. 数据库初始化提示
log_info "步骤8: 数据库初始化..."
log_warn "请手动执行数据库初始化："
echo "  cd ${APP_DIR}/server"
echo "  node src/scripts/init-db.js"

# 完成
echo ""
log_info "============================================"
log_info "部署完成！"
log_info "============================================"
echo ""
log_info "后续步骤："
echo "  1. 配置 .env.production 环境变量"
echo "  2. 初始化数据库: cd server && node src/scripts/init-db.js"
echo "  3. 配置Nginx: sudo nano /etc/nginx/sites-available/stock-management"
echo "  4. 重启Nginx: sudo systemctl restart nginx"
echo "  5. 查看日志: pm2 logs kuwanyubeiqi-server"
echo ""
log_info "PM2 常用命令："
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs"
echo "  重启应用: pm2 restart kuwanyubeiqi-server"
echo "  停止应用: pm2 stop kuwanyubeiqi-server"
echo ""
