# 生产环境治理与凭据轮换方案

更新时间：2026-06-03

## 目标

1. 确保 P0 后的新代码在生产环境启动前具备必要环境变量。
2. 避免生产密钥、数据库密码、OSS 密钥继续进入 Git 仓库。
3. 对曾经提交或暴露过的凭据做可控轮换。
4. 在轮换前保留回滚路径，避免数据库或服务不可用。

## 当前约束

- `.env.production` 已从 Git 跟踪移除，但服务器本地仍需要保留实际运行文件。
- Git 历史中曾出现过生产配置模板或凭据信息，移除跟踪不等于历史凭据失效。
- 本阶段不在未确认新凭据和维护窗口前直接修改生产数据库密码。

## 已完成

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 从 Git 跟踪移除 `server/.env.production`、`web/.env.production` | Done | 提交 `ecd8100` |
| 新增环境变量模板 | Done | `server/.env.example`、`web/.env.example` |
| 新增生产 env 校验脚本 | Done | `server/src/scripts/validate-production-env.js` |
| 生产启动强校验关键变量 | Done | `server/src/config/index.js` |

## 生产环境检查命令

在服务器后端目录执行：

```bash
cd /opt/stock-management/server
npm run env:check:production -- .env.production
```

预期：

- 输出 `[env-check] passed`。
- 不输出任何密钥原文。
- 如果 `JWT_SECRET`、`JWT_REFRESH_SECRET`、`DB_PASSWORD` 缺失或过短，应失败。

## 凭据轮换建议顺序

### 1. JWT 密钥

影响：所有已登录用户需要重新登录。

步骤：

1. 生成新的 `JWT_SECRET` 和 `JWT_REFRESH_SECRET`，长度至少 32 字符。
2. 更新服务器 `/opt/stock-management/server/.env.production`。
3. 执行环境校验。
4. 重启 PM2 后端进程。
5. 验证健康检查、登录、商品列表。

回滚：

1. 恢复旧 `.env.production`。
2. 重启 PM2。

### 2. 数据库密码

影响：如果 MySQL 用户密码和应用 env 不一致，后端无法连接数据库。

建议在低峰维护窗口执行。

步骤：

1. 数据库备份。
2. 确认当前 MySQL 用户和授权范围。
3. 修改 MySQL 用户密码。
4. 同步更新服务器 `.env.production` 的 `DB_PASSWORD`。
5. 执行环境校验。
6. 重启 PM2。
7. 验证健康检查、登录、分类、商品、入库、盘点。

回滚：

1. 将 MySQL 用户密码恢复为旧值。
2. 恢复旧 `.env.production`。
3. 重启 PM2。

### 3. 默认登录账号

影响：弱口令会直接影响生产系统安全。

建议：

- 生产环境禁用或修改 `admin/admin123`、`clerk/clerk123`。
- 保留至少一个店主账号。
- 记录账号交接方式，不把密码写入 Git 文档。

## 发布前生产只读核查项

| 检查项 | 命令/方式 | 预期 |
| --- | --- | --- |
| 当前 Git commit | `git rev-parse --short HEAD` | 与计划部署版本一致 |
| 后端路径 | `pwd` | `/opt/stock-management/server` 或实际 PM2 运行路径 |
| PM2 状态 | `pm2 list` | 后端 online |
| env 校验 | `npm run env:check:production -- .env.production` | 通过 |
| Nginx 配置 | `nginx -t` | 通过 |
| 上传目录 | `ls -ld uploads` | 后端有写权限，Nginx 可访问 |
| 健康检查 | `curl http://127.0.0.1:3000/api/health` | `code=200` |

## 待确认

1. 是否现在轮换 JWT secret。
2. 是否现在轮换 MySQL 密码。
3. 是否修改默认登录账号密码。
4. 是否申请正式域名和 HTTPS 证书。
