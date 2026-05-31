#!/bin/bash
# ============================================
# 酷玩预备齐库存管理系统 - 远程服务器部署脚本
# 在阿里云服务器上执行此脚本
# ============================================

set -e

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
echo "酷玩预备齐库存管理系统 - 远程部署"
echo "============================================"
echo ""

APP_DIR="/var/www/stock-management"

# 步骤1: 更新系统
log_step "[1/10] 更新系统..."
apt-get update -y > /dev/null 2>&1
apt-get install -y curl wget git vim nginx mysql-server redis-server build-essential > /dev/null 2>&1
log_info "系统更新完成"

# 步骤2: 安装Node.js 18
log_step "[2/10] 安装 Node.js 18..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
log_info "Node.js $(node -v) 安装完成"

# 步骤3: 安装PM2
log_step "[3/10] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
fi
log_info "PM2 $(pm2 -v) 安装完成"

# 步骤4: 配置MySQL
log_step "[4/10] 配置 MySQL..."
systemctl start mysql
systemctl enable mysql > /dev/null 2>&1

# 设置root密码
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'Root@2025!';" 2>/dev/null || true

# 创建数据库和用户
mysql -u root -pRoot@2025! -e "CREATE DATABASE IF NOT EXISTS kuwanyubeiqi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null || \
mysql -e "CREATE DATABASE IF NOT EXISTS kuwanyubeiqi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

mysql -e "CREATE USER IF NOT EXISTS 'kuwan_user'@'localhost' IDENTIFIED BY 'Kuwan@2025!';" 2>/dev/null || true
mysql -e "GRANT ALL PRIVILEGES ON kuwanyubeiqi.* TO 'kuwan_user'@'localhost';" 2>/dev/null || true
mysql -e "FLUSH PRIVILEGES;" 2>/dev/null || true
log_info "MySQL 配置完成"

# 步骤5: 配置Redis
log_step "[5/10] 配置 Redis..."
systemctl start redis
systemctl enable redis > /dev/null 2>&1
redis-cli ping > /dev/null 2>&1 && log_info "Redis 运行正常"

# 步骤6: 创建目录结构
log_step "[6/10] 创建目录结构..."
mkdir -p ${APP_DIR}/{server,web,backups}
mkdir -p ${APP_DIR}/server/{logs,uploads,src}
log_info "目录结构创建完成"

# 步骤7: 创建后端环境配置
log_step "[7/10] 创建后端配置..."
cat > ${APP_DIR}/server/.env.production << 'EOF'
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kuwanyubeiqi
DB_USER=kuwan_user
DB_PASSWORD=Kuwan@2025!
JWT_SECRET=kuwanyubeiqi-jwt-secret-key-2025
JWT_REFRESH_SECRET=kuwanyubeiqi-refresh-secret-key-2025
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
NODE_ENV=production
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
EOF
log_info "后端配置创建完成"

# 步骤8: 配置Nginx
log_step "[8/10] 配置 Nginx..."
cat > /etc/nginx/sites-available/stock-management << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        root /var/www/stock-management/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /uploads {
        alias /var/www/stock-management/server/uploads;
        expires 30d;
    }
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;
}
EOF

ln -sf /etc/nginx/sites-available/stock-management /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
log_info "Nginx 配置完成"

# 步骤9: 配置防火墙
log_step "[9/10] 配置防火墙..."
ufw allow OpenSSH > /dev/null 2>&1 || true
ufw allow 'Nginx Full' > /dev/null 2>&1 || true
ufw allow 3000/tcp > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
log_info "防火墙配置完成"

# 步骤10: 创建PM2配置
log_step "[10/10] 创建 PM2 配置..."
cat > ${APP_DIR}/server/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kuwanyubeiqi-server',
    script: './src/app.js',
    instances: 1,
    exec_mode: 'fork',
    env_production: {
      NODE_ENV: 'production'
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M'
  }]
};
EOF
log_info "PM2 配置创建完成"

echo ""
echo "============================================"
log_info "服务器环境配置完成！"
echo "============================================"
echo ""
echo "请继续执行以下步骤："
echo ""
echo "1. 上传项目代码到 ${APP_DIR}"
echo "2. 初始化数据库: cd ${APP_DIR}/server && node src/scripts/init-db.js"
echo "3. 构建前端: cd ${APP_DIR}/web && npm install && npm run build"
echo "4. 启动后端: cd ${APP_DIR}/server && pm2 start ecosystem.config.js --env production"
echo ""
echo "访问地址: http://$(curl -s ifconfig.me)"
