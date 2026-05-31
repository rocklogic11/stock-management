# 腾讯云一键部署命令（复制执行即可）

## 前提条件
1. 已购买腾讯云服务器（Ubuntu 20.04+ 或 CentOS 7+）
2. 已开放安全组端口：22、80、443、3000
3. 已通过SSH连接到服务器

---

## 🚀 一步到位：复制整个代码块执行

SSH连接到服务器后，复制以下**整个代码块**，`右键粘贴`执行：

```bash
# ========== 第一步：安装依赖 ==========
echo "开始安装依赖..."
apt update && apt upgrade -y
apt install -y curl wget git unzip software-properties-common nginx mysql-server redis-server

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 安装 PM2
npm install -g pm2

echo "依赖安装完成！"
node --version
npm --version
nginx -v
echo "============================================"

# ========== 第二步：配置数据库 ==========
echo "配置数据库..."
systemctl start mysql
systemctl enable mysql

# 创建数据库和用户（会自动提示输入密码）
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS kuwanyubeiqi_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'kuwanyubeiqi'@'localhost' IDENTIFIED BY 'Kuwanyuqi@2026';
GRANT ALL PRIVILEGES ON kuwanyubeiqi_prod.* TO 'kuwanyubeiqi'@'localhost';
FLUSH PRIVILEGES;
EOF

echo "数据库配置完成！"
echo "============================================"

# ========== 第三步：创建项目目录 ==========
echo "创建项目目录..."
mkdir -p /var/www/stock-management/{backups,server/logs}
cd /var/www/stock-management
echo "项目目录创建完成：$(pwd)"
echo "============================================"

# ========== 第四步：上传项目文件 ==========
echo "请将项目文件上传到 /var/www/stock-management/"
echo "在本地电脑执行以下命令上传项目："
echo "scp -r /c/Users/Remy WANG/projects/stockManagement/* root@你的服务器IP:/var/www/stock-management/"
echo "============================================"
read -p "文件上传完成后按回车继续..."
```

---

## 📂 第四步：上传项目文件（在本地电脑执行）

**在您的本地Windows电脑打开PowerShell，执行：**

```powershell
# 上传项目到腾讯云服务器（替换 你的服务器IP）
scp -r c:\Users\Remy WANG\projects\stockManagement\* root@你的服务器IP:/var/www/stock-management/
```

上传完成后，回到服务器SSH窗口，按**回车键**继续。

---

## 🔧 第五步：在服务器上继续执行（复制粘贴）

```bash
# ========== 第五步：安装后端依赖 ==========
cd /var/www/stock-management/server

# 创建生产环境配置
cat > .env.production <<'EOF'
NODE_ENV=production
PORT=3000
DB_DIALECT=mysql
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kuwanyubeiqi_prod
DB_USER=kuwanyubeiqi
DB_PASSWORD=Kuwanyuqi@2026
JWT_SECRET=7a3b9c8d2e5f1a4b8c9d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=9c8d2e5f1a4b8c9d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b
JWT_REFRESH_EXPIRES_IN=7d
REDIS_HOST=localhost
REDIS_PORT=6379
LOG_LEVEL=info
LOG_DIR=./logs
CORS_ORIGIN=*
EOF

echo "安装后端依赖（需要几分钟）..."
npm install --production

echo "后端依赖安装完成！"
echo "============================================"

# ========== 第六步：构建前端 ==========
cd /var/www/stock-management/web

cat > .env.production <<'EOF'
VITE_API_BASE_URL=/api/v1
VITE_APP_TITLE=库存预备齐库存管理系统
VITE_APP_VERSION=1.0.0
EOF

echo "安装前端依赖（需要几分钟）..."
npm install

echo "构建前端应用..."
npm run build

echo "前端构建完成！"
echo "============================================"

# ========== 第七步：初始化数据库 ==========
cd /var/www/stock-management/server
echo "初始化数据库..."
node src/scripts/init-db.js

echo "数据库初始化完成！"
echo "============================================"

# ========== 第八步：配置Nginx ==========
echo "配置Nginx..."
cat > /etc/nginx/sites-available/stock-management <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    location / {
        root /var/www/stock-management/web/dist;
        try_files $uri $uri/ /index.html;
        index index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
        
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate";
        }
    }
    
    location /uploads/ {
        alias /var/www/stock-management/server/uploads/;
        expires 30d;
        access_log off;
    }
    
    location /api/ {
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
    
    location /health {
        proxy_pass http://localhost:3000/api/health;
        access_log off;
    }
    
    access_log /var/log/nginx/stock-management_access.log;
    error_log /var/log/nginx/stock-management_error.log;
}
EOF

ln -sf /etc/nginx/sites-available/stock-management /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx

echo "Nginx配置完成！"
echo "============================================"

# ========== 第九步：启动服务 ==========
echo "启动Redis..."
systemctl start redis
systemctl enable redis

echo "使用PM2启动后端..."
cd /var/www/stock-management/server
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo "所有服务已启动！"
echo "============================================"

# ========== 第十步：验证部署 ==========
echo "验证部署..."
sleep 3

echo "PM2状态："
pm2 status

echo ""
echo "Nginx状态："
systemctl is-active nginx

echo ""
echo "MySQL状态："
systemctl is-active mysql

echo ""
echo "测试访问："
curl -s http://localhost/api/health || echo "健康检查失败，请查看日志"

echo ""
echo "============================================"
echo "  🎉 部署完成！"
echo "============================================"
echo ""
echo "访问地址："
echo "  http://$(curl -s ifconfig.me)"
echo ""
echo "默认管理员账号："
echo "  用户名: admin"
echo "  密码: admin123"
echo "  ⚠️ 请立即登录并修改默认密码！"
echo ""
echo "常用命令："
echo "  查看后端日志: pm2 logs kuwanyubeiqi-server"
echo "  重启后端: pm2 restart kuwanyubeiqi-server"
echo "  查看Nginx日志: tail -f /var/log/nginx/stock-management_error.log"
echo ""
```

---

## ✅ 部署完成标志

当您看到以下输出时，说明部署成功：
```
🎉 部署完成！
访问地址：http://你的服务器IP
默认管理员账号：
  用户名: admin
  密码: admin123
```

---

## 🔒 部署后必做

1. **立即修改默认密码**
   - 访问 `http://你的服务器IP`
   - 使用 `admin / admin123` 登录
   - 进入个人设置修改密码

2. **配置防火墙**
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 22/tcp
   ufw --force enable
   ```

3. **（可选）配置域名和SSL**
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d 你的域名
   ```

---

## 🆘 遇到问题？

1. **查看后端日志**：`pm2 logs kuwanyubeiqi-server`
2. **查看Nginx日志**：`tail -f /var/log/nginx/stock-management_error.log`
3. **重启后端**：`pm2 restart kuwanyubeiqi-server`
4. **重启Nginx**：`systemctl restart nginx`

---

**腾讯云安全组配置提醒**：
- 进入腾讯云控制台 → 安全组 → 添加规则
- 开放端口：22（SSH）、80（HTTP）、443（HTTPS）、3000（备用）
- 来源：0.0.0.0/0
