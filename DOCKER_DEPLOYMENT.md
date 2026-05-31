# ============================================
# Docker 部署方案
# ============================================

## 方案概述

使用 Docker Compose 一键部署完整应用栈：
- 后端：Node.js + Express
- 前端：Vue 3 静态文件 (Nginx)
- 数据库：MySQL 8.0
- 缓存：Redis
- 反向代理：Nginx

## 文件结构

```
stock-management/
├── docker-compose.yml
├── docker/
│   ├── backend/
│   │   └── Dockerfile
│   ├── frontend/
│   │   └── Dockerfile
│   └── nginx/
│       └── nginx.conf
└── .env.docker
```

## 快速开始

### 1. 安装 Docker

```bash
# Ubuntu
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo apt install -y docker-compose-plugin
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker.example .env.docker

# 编辑配置
nano .env.docker
```

### 3. 启动服务

```bash
# 构建并启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f

# 查看服务状态
docker compose ps
```

### 4. 初始化数据库

```bash
# 进入后端容器
docker compose exec backend node src/scripts/init-db.js

# 或导入SQL文件
docker compose exec mysql mysql -u root -p kuwanyubeiqi < 建表SQL_库存预备齐库存管理系统.sql
```

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| nginx | 80, 443 | 反向代理 + 前端静态文件 |
| backend | 3000 | Node.js 后端API |
| mysql | 3306 | MySQL 数据库 |
| redis | 6379 | Redis 缓存 |

## 常用命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f [service_name]

# 进入容器
docker compose exec backend sh
docker compose exec mysql mysql -u root -p

# 重新构建
docker compose build --no-cache

# 备份数据库
docker compose exec mysql mysqldump -u root -p kuwanyubeiqi > backup.sql

# 恢复数据库
docker compose exec -T mysql mysql -u root -p kuwanyubeiqi < backup.sql
```

## 生产环境注意

1. **修改默认密码** - 务必修改 `.env.docker` 中的密码
2. **配置SSL证书** - 将证书放置到 `docker/nginx/ssl/` 目录
3. **数据持久化** - MySQL数据存储在 Docker volume 中
4. **资源限制** - 可在 `docker-compose.yml` 中配置内存和CPU限制
5. **日志管理** - 配置日志驱动避免磁盘占满

## 故障排查

### 后端无法连接数据库

```bash
# 检查网络
docker compose exec backend ping mysql

# 检查MySQL日志
docker compose logs mysql
```

### 前端无法访问API

```bash
# 检查Nginx配置
docker compose exec nginx nginx -t

# 查看Nginx日志
docker compose logs nginx
```

## 性能优化

1. **启用Redis缓存** - 在 `.env.docker` 中配置Redis
2. **MySQL优化** - 挂载自定义 `my.cnf` 配置
3. **Nginx Gzip** - 已在配置中启用
4. **CDN加速** - 可将静态资源上传到CDN
