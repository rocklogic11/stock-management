# 生产发布运行手册

更新时间：2026-06-03

## 发布目标

将 GitHub `main` 当前版本发布到生产环境，并完成发布后观察。

## 发布前置条件

| 条件 | 状态 | 说明 |
| --- | --- | --- |
| P0 整改已提交并推送 | Done | `ecd8100` |
| 本地发布门禁 | Done | `npm run release:check` 已通过 |
| 生产环境只读核查 | Done | `docs/PRODUCTION_READONLY_AUDIT_2026-06-03.md` |
| 生产 env 键名存在 | Done | 只读核查确认 |
| 生产 env 强度校验 | Pending | 需部署新代码后执行 `npm run env:check:production -- .env.production` |
| 生产备份 | Pending | 发布前执行 |
| 生产部署 | Pending | 发布前执行 |
| 上线后观察 | Pending | 发布后执行 |

## 当前生产拓扑

| 项 | 值 |
| --- | --- |
| 前端目录 | `/var/www/stock-management/web/dist` |
| 后端目录 | `/opt/stock-management/server` |
| 上传目录 | `/opt/stock-management/server/uploads` |
| PM2 进程 | `kuwanyubeiqi-server`，2 个实例 online |
| Nginx | 配置检查通过 |
| 注意 | 生产目录不是 Git 工作树，当前无法从服务器直接追踪部署 commit |

## 发布前备份

建议备份目录：

```bash
BACKUP_DIR=/root/stock-management-backups/$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
```

备份命令：

```bash
# 备份后端运行目录
tar -czf "$BACKUP_DIR/server.tar.gz" -C /opt/stock-management server

# 备份前端静态文件
tar -czf "$BACKUP_DIR/web-dist.tar.gz" -C /var/www/stock-management/web dist

# 备份生产 env，不打印内容
cp /opt/stock-management/server/.env.production "$BACKUP_DIR/server.env.production"

# 备份数据库
mysqldump -u kuwan_user -p kuwanyubeiqi > "$BACKUP_DIR/kuwanyubeiqi.sql"
```

数据库备份说明：

- 不要把备份文件提交到 Git。
- 如果 MySQL 密码通过交互输入，不应写入命令历史。

## 发布步骤

由于当前生产目录不是 Git 工作树，建议使用临时发布目录拉取最新代码，再同步到运行目录：

```bash
RELEASE_DIR=/tmp/stock-management-release
rm -rf "$RELEASE_DIR"
git clone --branch main https://github.com/rocklogic11/stock-management "$RELEASE_DIR"
cd "$RELEASE_DIR"
git rev-parse --short HEAD
```

后端：

```bash
cd "$RELEASE_DIR/server"
npm install
npm run migrate:barcode-images
npm run env:check:production -- /opt/stock-management/server/.env.production

rsync -a --delete \
  --exclude node_modules \
  --exclude uploads \
  --exclude logs \
  --exclude .env \
  --exclude .env.production \
  "$RELEASE_DIR/server/" /opt/stock-management/server/

cd /opt/stock-management/server
npm install --omit=dev
pm2 restart kuwanyubeiqi-server
```

前端：

```bash
cd "$RELEASE_DIR/web"
npm install
npm run build
rsync -a --delete "$RELEASE_DIR/web/dist/" /var/www/stock-management/web/dist/
```

Nginx：

```bash
nginx -t
```

本次不需要重启 Nginx，除非修改 Nginx 配置。

## 发布后验证

```bash
curl -fsS http://127.0.0.1:3000/api/health
pm2 list
nginx -t
```

然后执行外网验证：

| 检查 | 预期 |
| --- | --- |
| PC 打开系统 | 页面加载，无网络错误 |
| 店主登录 | 成功 |
| 分类接口 | 非空 |
| 商品列表 | 可加载 |
| 新增商品 | 可保存 |
| 图片上传 | 上传后 `/uploads` 可访问 |
| 店员权限 | 不显示成本字段 |
| 入库 | 新建不改库存，确认后改库存 |
| 盘点 | 库存变化冲突被阻止 |

## 回滚步骤

如果发布后出现 P0/P1 问题：

```bash
# 停止当前后端
pm2 stop kuwanyubeiqi-server

# 恢复后端
rm -rf /opt/stock-management/server
mkdir -p /opt/stock-management
tar -xzf "$BACKUP_DIR/server.tar.gz" -C /opt/stock-management

# 恢复前端
rm -rf /var/www/stock-management/web/dist
mkdir -p /var/www/stock-management/web
tar -xzf "$BACKUP_DIR/web-dist.tar.gz" -C /var/www/stock-management/web

# 恢复 env
cp "$BACKUP_DIR/server.env.production" /opt/stock-management/server/.env.production

# 如数据库迁移造成不兼容，再恢复数据库
# mysql -u kuwan_user -p kuwanyubeiqi < "$BACKUP_DIR/kuwanyubeiqi.sql"

cd /opt/stock-management/server
npm install --omit=dev
pm2 start kuwanyubeiqi-server
pm2 list
```

回滚后必须验证：

- `/api/health`
- 登录
- 分类
- 商品列表
- 新增商品

## 上线后观察

观察至少 30 分钟：

| 指标 | 目标 |
| --- | --- |
| PM2 | online，无持续重启 |
| 健康检查 | 持续 `code=200` |
| 登录 | 店主/店员可登录 |
| Nginx | 无 502/404 异常 |
| 上传目录 | 新图片可访问 |
| 核心业务 | 商品、入库、盘点无 P0/P1 缺陷 |

## 下一步

执行生产发布前备份，然后按本手册进行部署与上线后观察。
