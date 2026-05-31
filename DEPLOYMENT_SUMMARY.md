# ============================================
# 库存预备齐库存管理系统 - 部署总结
# ============================================

## 📦 部署方案概览

本项目提供三种部署方案，您可以根据实际情况选择：

| 方案 | 适用场景 | 难度 | 推荐度 |
|------|----------|------|--------|
| **方案1: 直接部署** | 传统服务器、VPS | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **方案2: Docker部署** | 云服务器、容器化环境 | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **方案3: 简化部署** | 快速演示、内部使用 | ⭐ | ⭐⭐⭐ |

---

## 🚀 方案1: 直接部署 (推荐生产环境)

### 架构图
```
用户浏览器
    ↓
Nginx (80/443端口)
    ↓
├─ 静态文件 (Vue前端)
└─ 反向代理 → Node.js后端 (3000端口)
                    ↓
            MySQL/SQLite数据库
```

### 快速开始

```bash
# 1. 克隆项目到服务器
cd /var/www
git clone <your-repo> stock-management
cd stock-management

# 2. 运行部署脚本
chmod +x deploy.sh
./deploy.sh

# 3. 配置环境变量
nano server/.env.production
# ⚠️ 务必修改 JWT_SECRET 和数据库密码！

# 4. 初始化数据库
cd server
node src/scripts/init-db.js

# 5. 启动服务
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# 6. 配置Nginx
sudo cp nginx.conf /etc/nginx/sites-available/stock-management
sudo ln -s /etc/nginx/sites-available/stock-management /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 详细文档
📖 完整部署指南: `DEPLOYMENT_GUIDE.md`

---

## 🐳 方案2: Docker部署 (推荐云环境)

### 架构图
```
Docker Compose 管理
    ├─ Nginx容器 (反向代理 + 前端)
    ├─ Backend容器 (Node.js后端)
    ├─ MySQL容器 (数据库)
    └─ Redis容器 (缓存)
```

### 快速开始

```bash
# 1. 安装Docker和Docker Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 2. 配置环境变量
cp .env.docker.example .env.docker
nano .env.docker
# ⚠️ 务必修改所有密码和密钥！

# 3. 一键启动
docker compose up -d

# 4. 初始化数据库
docker compose exec backend node src/scripts/init-db.js

# 5. 查看日志
docker compose logs -f

# 6. 访问应用
# 浏览器打开: http://服务器IP
```

### 常用命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 查看日志
docker compose logs -f [service_name]

# 重启服务
docker compose restart backend

# 备份数据库
docker compose exec mysql mysqldump -u root -p kuwanyubeiqi > backup.sql
```

### 详细文档
📖 Docker部署指南: `DOCKER_DEPLOYMENT.md`

---

## ⚡ 方案3: 简化部署 (快速演示)

适合快速演示或内部小团队使用，无需安装Nginx和PM2。

### 快速开始

```bash
# 1. 构建前端
cd web
npm install
npm run build

# 2. 启动后端 (已集成前端静态文件服务)
cd ../server
npm install
node src/app.js

# 3. 访问应用
# 浏览器打开: http://localhost:3000
```

### 生产环境优化

```bash
# 使用PM2管理进程
npm install -g pm2
pm2 start src/app.js --name kuwanyubeiqi
pm2 save
```

---

## 🔧 配置清单

### 必须修改的配置 ⚠️

1. **JWT密钥** (安全关键)
```bash
# 生成安全密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 将输出的密钥填入 .env.production 的 JWT_SECRET
```

2. **数据库密码**
   - MySQL用户密码必须修改
   - 不要使用默认密码

3. **CORS域名**
   - 生产环境必须指定允许的域名
   - 不要使用 `*` 通配符

### 环境变量文件说明

| 文件 | 用途 |
|------|------|
| `server/.env` | 开发环境配置 |
| `server/.env.production` | 生产环境配置 |
| `server/.env.production.example` | 配置模板 (参考) |
| `web/.env.production` | 前端生产环境配置 |
| `.env.docker` | Docker部署配置 |

---

## 📂 文件结构

```
stock-management/
├── server/                      # 后端服务
│   ├── .env.production          # 生产环境变量 ⚠️ 需配置
│   ├── .env.production.example  # 环境变量模板
│   ├── ecosystem.config.js      # PM2配置
│   └── src/
│       └── app.js               # 后端入口
│
├── web/                         # 前端应用
│   ├── .env.production          # 前端生产环境变量
│   ├── dist/                    # 构建产物 (自动生成)
│   └── vite.config.js           # Vite配置 (已更新)
│
├── docker-compose.yml           # Docker Compose配置
├── nginx.conf                   # Nginx配置模板
│
├── deploy.sh                    # Linux部署脚本
├── deploy.ps1                   # Windows部署脚本
│
├── scripts/
│   ├── backup-db.sh            # 数据库备份脚本 (Linux)
│   ├── backup-db.ps1           # 数据库备份脚本 (Windows)
│   └── setup-cron.sh           # 定时任务设置脚本
│
├── docker/                      # Docker相关文件
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   └── nginx/nginx.conf
│
├── DEPLOYMENT_GUIDE.md          # 详细部署指南
├── DOCKER_DEPLOYMENT.md        # Docker部署指南
├── DEPLOYMENT_CHECKLIST.md      # 部署检查清单
└── DEPLOYMENT_SUMMARY.md       # 本文档
```

---

## 📋 部署检查清单

部署前请对照检查: `DEPLOYMENT_CHECKLIST.md`

关键检查项：
- [ ] JWT_SECRET已修改
- [ ] 数据库密码已修改
- [ ] 数据库已初始化
- [ ] PM2已启动后端
- [ ] Nginx已配置 (或直接访问3000端口)
- [ ] 防火墙已配置
- [ ] SSL证书已配置 (可选但推荐)
- [ ] 数据库备份策略已制定

---

## 🔐 安全建议

1. **修改所有默认密码和密钥**
2. **启用HTTPS** (使用Let's Encrypt免费证书)
3. **配置防火墙** (只开放80, 443, 22端口)
4. **定期更新依赖** (`npm audit fix`)
5. **启用日志监控**
6. **配置数据库备份** (每日自动备份)
7. **使用非root用户运行应用**

---

## 📞 故障排查

### 后端无法启动

```bash
# 查看PM2日志
pm2 logs kuwanyubeiqi-server

# 检查端口占用
sudo lsof -i :3000

# 测试数据库连接
mysql -u username -p -h localhost
```

### 前端无法访问

```bash
# 检查Nginx状态
sudo systemctl status nginx

# 测试Nginx配置
sudo nginx -t

# 检查静态文件
ls -la /var/www/stock-management/web/dist
```

### Docker部署问题

```bash
# 查看容器状态
docker compose ps

# 查看容器日志
docker compose logs [service_name]

# 重启所有服务
docker compose restart
```

---

## 📊 性能优化建议

1. **启用Redis缓存** - 提升API响应速度
2. **配置Nginx Gzip** - 减少传输大小 (已配置)
3. **使用CDN** - 加速静态资源加载
4. **数据库索引** - 优化查询性能
5. **启用HTTP/2** - Nginx配置中已支持

---

## 📝 维护命令速查

```bash
# PM2 进程管理
pm2 status                      # 查看状态
pm2 logs                        # 查看日志
pm2 restart kuwanyubeiqi-server # 重启应用
pm2 monit                       # 实时监控

# 数据库备份
./scripts/backup-db.sh         # Linux备份
# 或
node scripts/backup-db.js       # Node.js备份脚本

# Nginx 管理
sudo systemctl status nginx     # 查看状态
sudo nginx -t                  # 测试配置
sudo systemctl restart nginx   # 重启

# Docker 管理
docker compose ps               # 查看状态
docker compose logs -f         # 查看日志
docker compose restart         # 重启服务
```

---

## 📖 相关文档

- [部署指南](./DEPLOYMENT_GUIDE.md) - 详细部署步骤
- [Docker部署](./DOCKER_DEPLOYMENT.md) - Docker方式部署
- [部署检查清单](./DEPLOYMENT_CHECKLIST.md) - 部署前检查项
- [API接口设计](../API接口设计_库存预备齐库存管理系统.md)
- [数据库设计](../数据库设计_库存预备齐库存管理系统.md)

---

## 🎉 部署完成！

部署完成后，请访问: `http://your-server-ip` 或 `https://yourdomain.com`

默认管理员账号：
- 用户名: `admin`
- 密码: `admin123` (首次登录后请立即修改)

---

**最后更新**: 2026-04-29
**文档版本**: 1.0
