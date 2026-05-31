#!/bin/bash
# ============================================
# 酷玩预备齐库存管理系统 - 自动化部署脚本
# 使用方法：
#   1. 上传此脚本到腾讯云服务器
#   2. 执行: chmod +x auto-deploy.sh && sudo ./auto-deploy.sh
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 打印函数
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP $1/$2]${NC} $3"; }

# 配置变量
APP_NAME="stock-management"
APP_DIR="/var/www/${APP_NAME}"
BACKUP_DIR="${APP_DIR}/backups"
LOG_DIR="${APP_DIR}/server/logs"
DB_NAME="kuwanyubeiqi_prod"
DB_USER="kuwanyubeiqi"
DB_PASSWORD=""
JWT_SECRET=""
JWT_REFRESH_SECRET=""
DOMAIN=""

# 显示横幅
clear
echo ""
echo "============================================"
echo "  酷玩预备齐库存管理系统 - 自动化部署"
echo "============================================"
echo ""

# 检查root权限
if [ "$EUID" -ne 0 ]; then 
    log_error "请使用 sudo 运行此脚本"
    echo "使用方法: sudo ./auto-deploy.sh"
    exit 1
fi

log_info "开始自动化部署流程..."
echo ""

# ============================================
# 步骤1: 收集配置信息
# ============================================
log_step "1" "8" "收集配置信息"

read -p "请输入域名 (例如: example.com, 留空则使用IP访问): " DOMAIN
read -p "请输入数据库密码 (至少8位): " DB_PASSWORD
read -p "请输入JWT密钥 (至少32字符, 留空自动生成): " JWT_SECRET
read -p "请输入JWT刷新密钥 (至少32字符, 留空自动生成): " JWT_REFRESH_SECRET

# 自动生成密钥
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -hex 32)
    log_info "已自动生成JWT_SECRET"
fi

if [ -z "$JWT_REFRESH_SECRET" ]; then
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    log_info "已自动生成JWT_REFRESH_SECRET"
fi

echo ""
log_info "配置信息确认:"
echo "  域名: ${DOMAIN:-未设置 (将使用IP访问)}"
echo "  数据库名: ${DB_NAME}"
echo "  数据库用户: ${DB_USER}"
echo "  JWT密钥: 已设置"
echo ""
read -p "确认开始部署? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# ============================================
# 步骤2: 更新系统并安装依赖
# ============================================
log_step "2" "8" "更新系统并安装依赖"

log_info "更新系统软件包..."
apt update && apt upgrade -y

log_info "安装基础工具..."
apt install -y curl wget git unzip software-properties-common

log_info "安装Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

log_info "安装PM2..."
npm install -g pm2

log_info "安装Nginx..."
apt install -y nginx

log_info "安装MySQL..."
apt install -y mysql-server

log_info "安装Redis (可选)..."
apt install -y redis-server

echo ""
log_info "✓ 依赖安装完成"
node --version
npm --version
nginx -v
mysql --version
echo ""

# ============================================
# 步骤3: 配置MySQL
# ============================================
log_step "3" "8" "配置MySQL数据库"

log_info "启动MySQL服务..."
systemctl start mysql
systemctl enable mysql

log_info "创建数据库和用户..."
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
EOF

log_info "✓ 数据库配置完成"
echo ""

# ============================================
# 步骤4: 创建项目目录并上传代码
# ============================================
log_step "4" "8" "准备项目目录"

log_info "创建项目目录..."
mkdir -p ${APP_DIR}
mkdir -p ${BACKUP_DIR}
mkdir -p ${LOG_DIR}

log_info "请将项目代码上传到 ${APP_DIR}"
log_warn "上传方式1: 使用scp从本地上传"
echo "  scp -r ./stockManagement/* root@你的服务器IP:${APP_DIR}/"
log_warn "上传方式2: 从Git仓库克隆"
echo "  cd ${APP_DIR} && git clone <你的仓库地址> ."
echo ""
read -p "代码已上传? 按回车继续..."

echo ""
log_info "✓ 项目目录准备完成"
echo ""

# ============================================
# 步骤5: 安装后端依赖
# ============================================
log_step "5" "8" "安装后端依赖"

cd ${APP_DIR}/server

log_info "创建生产环境配置..."
cat > .env.production <<EOF
# 环境标识
NODE_ENV=production

# 服务端口
PORT=3000

# 数据库配置
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# JWT配置
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_REFRESH_EXPIRES_IN=7d

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 日志配置
LOG_LEVEL=info
LOG_DIR=./logs

# CORS配置
CORS_ORIGIN=${DOMAIN:-http://localhost:3000}
EOF

log_info "安装后端依赖 (这可能需要几分钟)..."
npm install --production

log_info "✓ 后端依赖安装完成"
echo ""

# ============================================
# 步骤6: 构建前端
# ============================================
log_step "6" "8" "构建前端应用"

cd ${APP_DIR}/web

log_info "创建前端生产配置..."
cat > .env.production <<EOF
VITE_API_BASE_URL=http://${DOMAIN:-localhost:3000}/api/v1
VITE_APP_TITLE=酷玩预备齐库存管理系统
VITE_APP_VERSION=1.0.0
EOF

log_info "安装前端依赖 (这可能需要几分钟)..."
npm install

log_info "构建前端应用..."
npm run build

log_info "✓ 前端构建完成"
echo ""

# ============================================
# 步骤7: 初始化数据库
# ============================================
log_step "7" "8" "初始化数据库"

cd ${APP_DIR}/server

log_info "初始化数据库表和初始数据..."
node src/scripts/init-db.js

log_info "✓ 数据库初始化完成"
echo ""

# ============================================
# 步骤8: 配置Nginx并启动服务
# ============================================
log_step "8" "8" "配置Nginx并启动服务"

log_info "创建Nginx配置..."
cat > /etc/nginx/sites-available/stock-management <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN:-_};
    
    # Gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # 前端静态文件
    location / {
        root ${APP_DIR}/web/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
        
        # 缓存策略
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
        
        location ~* \\.html$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
        }
    }
    
    # 上传文件
    location /uploads/ {
        alias ${APP_DIR}/server/uploads/;
        expires 30d;
        access_log off;
    }
    
    # 后端API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }
    
    # 日志
    access_log /var/log/nginx/stock-management_access.log;
    error_log /var/log/nginx/stock-management_error.log;
}
EOF

log_info "启用Nginx配置..."
ln -sf /etc/nginx/sites-available/stock-management /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

log_info "测试Nginx配置..."
nginx -t

log_info "启动Redis..."
systemctl start redis
systemctl enable redis

log_info "使用PM2启动后端服务..."
cd ${APP_DIR}/server
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

log_info "重启Nginx..."
systemctl restart nginx
systemctl enable nginx

echo ""
log_info "✓ 所有服务已启动"
echo ""

# ============================================
# 部署完成
# ============================================
echo ""
echo "============================================"
echo "  🎉 部署完成！"
echo "============================================"
echo ""
log_info "服务状态:"
echo "  - Nginx: $(systemctl is-active nginx)"
echo "  - MySQL: $(systemctl is-active mysql)"
echo "  - Redis: $(systemctl is-active redis)"
echo "  - PM2: $(pm2 list | grep -c online) 个应用运行中"
echo ""
log_info "访问地址:"
if [ -n "$DOMAIN" ]; then
    echo "  http://${DOMAIN}"
else
    echo "  http://$(curl -s ifconfig.me)"
fi
echo ""
log_info "默认管理员账号:"
echo "  用户名: admin"
echo "  密码: admin123"
echo "  ⚠️ 请立即登录并修改默认密码！"
echo ""
log_info "常用命令:"
echo "  查看后端日志: pm2 logs kuwanyubeiqi-server"
echo "  重启后端: pm2 restart kuwanyubeiqi-server"
echo "  查看Nginx日志: tail -f /var/log/nginx/stock-management_error.log"
echo ""
log_info "下一步建议:"
echo "  1. 配置SSL证书 (使用Let's Encrypt):"
echo "     sudo certbot --nginx -d ${DOMAIN}"
echo "  2. 设置防火墙:"
echo "     sudo ufw allow 80/tcp"
echo "     sudo ufw allow 443/tcp"
echo "     sudo ufw enable"
echo "  3. 设置定时备份:"
echo "     chmod +x ${APP_DIR}/scripts/setup-cron.sh"
echo "     ${APP_DIR}/scripts/setup-cron.sh"
echo ""
log_info "部署日志已保存到: /var/log/stock-management-deploy.log"
echo "============================================" | tee -a /var/log/stock-management-deploy.log
echo ""
