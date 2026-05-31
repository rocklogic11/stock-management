# 库存预备齐库存管理系统 - 阿里云部署指南

## 服务器信息
- **IP**: 121.40.110.240
- **密码**: zuBu-5567
- **操作系统**: Ubuntu 22.04

---

## 快速部署（推荐）

### 步骤1：连接到服务器

```bash
ssh root@121.40.110.240
# 输入密码: zuBu-5567
```

### 步骤2：一键安装环境

```bash
curl -fsSL https://raw.githubusercontent.com/nodesource/distributions/master/deb/setup_18.x | bash -
apt-get update
apt-get install -y nodejs nginx mysql-server redis-server git curl vim
npm install -g pm2
```

### 步骤3：创建应用目录

```bash
mkdir -p /var/www/stock-management
cd /var/www/stock-management
```

### 步骤4：上传项目代码

**方式A - 使用 Git（推荐）:**
```bash
cd /var/www/stock-management
git clone <您的Git仓库地址> .
```

**方式B - 使用 SCP 从本地上传:**
在本地电脑执行：
```bash
# 压缩项目
cd c:/Users/Remy WANG/projects/stockManagement
tar -czvf stock-management.tar.gz server/ web/ docker/ nginx.conf docker-compose.yml

# 上传到服务器
scp stock-management.tar.gz root@121.40.110.240:/var/www/stock-management/

# SSH到服务器解压
ssh root@121.40.110.240 "cd /var/www/stock-management && tar -xzvf stock-management.tar.gz"
```

---

## 详细部署步骤

### 1. 配置 MySQL

```bash
# 启动 MySQL
systemctl start mysql
systemctl enable mysql

# 创建数据库
mysql -u root -p
# 输入 root 密码（默认为空或安装时设置）

# 在 MySQL 中执行：
CREATE DATABASE kuwanyubeiqi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kuwan_user'@'localhost' IDENTIFIED BY 'Kuwan@2025!';
GRANT ALL PRIVILEGES ON kuwanyubeiqi.* TO 'kuwan_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2. 配置 Redis

```bash
systemctl start redis
systemctl enable redis
redis-cli ping  # 应返回 PONG
```

### 3. 配置后端

```bash
cd /var/www/stock-management/server

# 创建环境配置文件
cat > .env.production << 'EOF'
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

# 安装依赖
npm install

# 初始化数据库
node src/scripts/init-db.js
```

### 4. 配置前端

```bash
cd /var/www/stock-management/web

# 安装依赖
npm install

# 修改 API 地址配置
# 编辑 web/.env.production 文件：
cat > .env.production << 'EOF'
VITE_API_BASE_URL=http://121.40.110.240/api
EOF

# 构建生产版本
npm run build
```

### 5. 配置 Nginx

```bash
cat > /etc/nginx/sites-available/stock-management << 'EOF'
server {
    listen 80;
    server_name 121.40.110.240;
    
    # 前端静态文件
    location / {
        root /var/www/stock-management/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 上传文件
    location /uploads {
        alias /var/www/stock-management/server/uploads;
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

# 测试配置
nginx -t

# 重启 Nginx
systemctl restart nginx
```

### 6. 启动后端服务

```bash
cd /var/www/stock-management/server

# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
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
    watch: false
  }]
};
EOF

# 使用 PM2 启动
pm2 start ecosystem.config.js --env production

# 保存 PM2 配置
pm2 save
pm2 startup systemd
```

---

## 验证部署

### 1. 检查服务状态

```bash
# 检查 PM2 状态
pm2 status

# 检查 Nginx 状态
systemctl status nginx

# 检查 MySQL 状态
systemctl status mysql

# 检查 Redis 状态
systemctl status redis
```

### 2. 访问系统

打开浏览器访问：
- **前端**: http://121.40.110.240
- **API 测试**: http://121.40.110.240/api/health

### 3. 默认登录账号

- **店主账号**: `owner` / `password123`
- **店员账号**: `staff` / `password123`

---

## 常用命令

```bash
# 查看日志
pm2 logs kuwanyubeiqi-server

# 重启后端
pm2 restart kuwanyubeiqi-server

# 重启 Nginx
systemctl restart nginx

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 备份数据库
mysqldump -u kuwan_user -p kuwanyubeiqi > backup_$(date +%Y%m%d).sql
```

---

## 故障排查

### 问题1: 无法访问网站

```bash
# 检查防火墙
ufw status
ufw allow 80/tcp
ufw allow 443/tcp

# 检查安全组（阿里云控制台）
# 确保入方向允许 80, 443, 3000 端口
```

### 问题2: API 返回 502

```bash
# 检查后端是否运行
pm2 status

# 检查后端日志
pm2 logs

# 检查端口占用
netstat -tlnp | grep 3000
```

### 问题3: 数据库连接失败

```bash
# 检查 MySQL 是否运行
systemctl status mysql

# 检查数据库用户
mysql -u kuwan_user -p -e "SHOW DATABASES;"
```

---

## 下一步优化

1. **配置 HTTPS**: 使用 Let's Encrypt 免费证书
2. **配置域名**: 将域名解析到 121.40.110.240
3. **配置自动备份**: 定期备份数据库
4. **配置监控**: 使用阿里云监控或自建监控

---

## 需要帮助？

如果遇到问题，请提供：
1. 错误信息截图
2. 相关日志输出 (`pm2 logs` 或 `nginx -t`)
3. 当前执行到哪一步
