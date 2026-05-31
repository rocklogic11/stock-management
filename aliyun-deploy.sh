#!/bin/bash
# ============================================
# 酷玩预备齐库存管理系统 - 阿里云服务器一键部署脚本
# 目标服务器: 121.40.110.240
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

echo "============================================"
echo "酷玩预备齐库存管理系统 - 阿里云部署"
echo "============================================"
echo ""

# 配置
APP_NAME="stock-management"
APP_DIR="/var/www/${APP_NAME}"
DOMAIN="121.40.110.240"

# 1. 更新系统
log_step "步骤1/10: 更新系统软件包..."
apt-get update -y
apt-get upgrade -y

# 2. 安装基础工具
log_step "步骤2/10: 安装基础工具..."
apt-get install -y curl wget git vim nginx mysql-server redis-server

# 3. 安装 Node.js 18
log_step "步骤3/10: 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node -v
npm -v

# 4. 安装 PM2
log_step "步骤4/10: 安装 PM2..."
npm install -g pm2
pm2 -v

# 5. 配置 MySQL
log_step "步骤5/10: 配置 MySQL..."
systemctl start mysql
systemctl enable mysql

# 创建数据库和用户
mysql -e "CREATE DATABASE IF NOT EXISTS kuwanyubeiqi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'kuwan_user'@'localhost' IDENTIFIED BY 'Kuwan@2025!';"
mysql -e "GRANT ALL PRIVILEGES ON kuwanyubeiqi.* TO 'kuwan_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"
log_info "MySQL 配置完成"

# 6. 配置 Redis
log_step "步骤6/10: 配置 Redis..."
systemctl start redis
systemctl enable redis
redis-cli ping
log_info "Redis 配置完成"

# 7. 创建应用目录
log_step "步骤7/10: 创建应用目录..."
mkdir -p ${APP_DIR}
mkdir -p ${APP_DIR}/backups
mkdir -p ${APP_DIR}/server/logs
mkdir -p ${APP_DIR}/server/uploads

# 8. 创建环境配置文件
log_step "步骤8/10: 创建环境配置文件..."
cat > ${APP_DIR}/server/.env.production << 'EOF'
# 数据库配置
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kuwanyubeiqi
DB_USER=kuwan_user
DB_PASSWORD=Kuwan@2025!

# JWT配置
JWT_SECRET=kuwanyubeiqi-jwt-secret-key-2025
JWT_REFRESH_SECRET=kuwanyubeiqi-refresh-secret-key-2025
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 服务器配置
PORT=3000
NODE_ENV=production

# 文件上传
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
EOF

log_info "环境配置文件已创建"

# 9. 配置 Nginx
log_step "步骤9/10: 配置 Nginx..."
cat > /etc/nginx/sites-available/stock-management << EOF
server {
    listen 80;
    server_name ${DOMAIN};
    
    # 前端静态文件
    location / {
        root ${APP_DIR}/web/dist;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    # API 代理
    location /api {
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
    
    # 上传文件
    location /uploads {
        alias ${APP_DIR}/server/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
    
    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/stock-management /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试 Nginx 配置
nginx -t
systemctl restart nginx
systemctl enable nginx

log_info "Nginx 配置完成"

# 10. 创建 PM2 配置文件
log_step "步骤10/10: 创建 PM2 配置文件..."
cat > ${APP_DIR}/server/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kuwanyubeiqi-server',
    script: './src/app.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    kill_timeout: 5000,
    listen_timeout: 10000
  }]
};
EOF

log_info "PM2 配置文件已创建"

echo ""
echo "============================================"
log_info "服务器环境配置完成！"
echo "============================================"
echo ""
log_info "已安装："
echo "  - Node.js $(node -v)"
echo "  - Nginx $(nginx -v 2>&1 | head -1)"
echo "  - MySQL $(mysql --version | head -1)"
echo "  - Redis $(redis-server --version | head -1)"
echo "  - PM2 $(pm2 -v)"
echo ""
log_warn "下一步：上传项目代码并部署"
echo "  应用目录: ${APP_DIR}"
echo ""
