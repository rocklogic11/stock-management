# ============================================
# 库存预备齐库存管理系统 - 部署指南
# ============================================

## 系统要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 7+)
- **Node.js**: v16.0+ (推荐 v18 LTS)
- **数据库**: MySQL 5.7+ 或 SQLite 3.x
- **Web服务器**: Nginx 1.18+
- **进程管理**: PM2
- **可选**: Redis 5.0+ (用于缓存)

## 部署架构

```
Client Browser
       ↓
    Nginx (80/443)
       ↓
   Vue SPA (静态文件)
       ↓ (API请求)
    Node.js (3000)
       ↓
MySQL/SQLite
```

## 部署步骤

### 1. 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PM2
sudo npm install -g pm2

# 安装 Nginx
sudo apt install -y nginx

# 安装 MySQL (可选，也可用 SQLite)
sudo apt install -y mysql-server
```

### 2. 数据库配置

#### 选项A: MySQL (推荐生产环境)

```bash
# 登录MySQL
sudo mysql

# 创建数据库和用户
CREATE DATABASE kuwanyubeiqi_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kuwanyubeiqi'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON kuwanyubeiqi_prod.* TO 'kuwanyubeiqi'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 选项B: SQLite (轻量级)

```bash
# 无需安装，Sequelize会自动创建数据库文件
# 确保服务器有写权限
```

### 3. 项目部署

```bash
# 克隆/上传项目到服务器
cd /var/www
sudo git clone <your-repo> stock-management
cd stock-management

# 安装后端依赖
cd server
npm install --production

# 安装前端依赖并构建
cd ../web
npm install
npm run build

# 返回后端目录
cd ../server
```

### 4. 配置环境变量

```bash
# 编辑生产环境配置
nano .env.production

# 修改以下关键配置：
# - DB_DIALECT=mysql (或 sqlite)
# - DB_PASSWORD=你的安全密码
# - JWT_SECRET=随机长字符串 (至少32字符)
# - JWT_REFRESH_SECRET=另一个随机长字符串
```

生成安全密钥：
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. 初始化数据库

```bash
# 使用MySQL时，先导入建表SQL
mysql -u username -p kuwanyubeiqi_prod < ../建表SQL_库存预备齐库存管理系统.sql

# 或使用Sequelize自动同步
NODE_ENV=production node src/scripts/init-db.js
```

### 6. 使用PM2启动后端

```bash
# 启动应用
pm2 start ecosystem.config.js --env production

# 查看状态
pm2 status

# 查看日志
pm2 logs kuwanyubeiqi-server

# 设置开机自启
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER
pm2 save
```

### 7. 配置Nginx

```bash
# 复制Nginx配置
sudo cp nginx.conf /etc/nginx/sites-available/stock-management
sudo ln -s /etc/nginx/sites-available/stock-management /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

### 8. SSL证书配置 (可选但推荐)

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

## 维护操作

### 更新部署

```bash
# 拉取最新代码
cd /var/www/stock-management
git pull

# 重新构建前端
cd web
npm run build

# 重启后端
cd ../server
pm2 restart kuwanyubeiqi-server
```

### 备份数据库

```bash
# MySQL备份
mysqldump -u username -p kuwanyubeiqi_prod > backup_$(date +%Y%m%d).sql

# SQLite备份
cp server/data/kuwanyubeiqi.db backups/kuwanyubeiqi_$(date +%Y%m%d).db
```

### 查看日志

```bash
# PM2日志
pm2 logs kuwanyubeiqi-server

# Nginx日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 性能监控

```bash
# PM2监控
pm2 monit

# 查看详细状态
pm2 show kuwanyubeiqi-server
```

## 故障排查

### 后端无法启动

```bash
# 检查端口占用
sudo lsof -i :3000

# 检查环境变量
cd server && cat .env.production

# 查看详细错误
pm2 logs kuwanyubeiqi-server --err
```

### 前端无法访问

```bash
# 检查Nginx状态
sudo systemctl status nginx

# 检查静态文件路径
ls -la /var/www/stock-management/web/dist

# 检查Nginx配置
sudo nginx -t
```

### 数据库连接失败

```bash
# MySQL连接测试
mysql -u username -p -h localhost

# 检查数据库服务
sudo systemctl status mysql

# 查看后端数据库配置
cat server/.env.production
```

## 安全建议

1. **修改默认JWT密钥** - 必须修改为随机长字符串
2. **使用强密码** - 数据库密码至少12位
3. **启用HTTPS** - 使用Let's Encrypt免费证书
4. **配置防火墙** - 只开放80, 443, 22端口
5. **定期更新** - 保持系统和依赖更新
6. **备份策略** - 每日自动备份数据库
7. **日志监控** - 监控异常访问和错误日志

## 性能优化

1. **启用Gzip压缩** - Nginx配置中已包含
2. **配置缓存** - 静态资源缓存1年
3. **使用Redis** - 配置Redis缓存提升性能
4. **数据库连接池** - Sequelize已配置连接池
5. **CDN加速** - 可选配置CDN分发静态资源

## 联系方式

如遇部署问题，请联系：
- 技术支持：[联系方式]
- 文档更新：2026-04-29
