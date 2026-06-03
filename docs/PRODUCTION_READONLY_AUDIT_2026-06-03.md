# 生产服务器只读核查记录

时间：2026-06-03 10:17 Asia/Shanghai

## 核查原则

- 本次只读检查，不修改服务器文件、数据库、PM2、Nginx。
- 不输出 `.env.production` 的密钥值，只检查变量键名是否存在。

## 核查结果

| 项目 | 结果 |
| --- | --- |
| 服务器时间 | 2026-06-03 10:17:11 +0800 |
| 主机名 | iZbp1btdtenhcczka22qr8Z |
| `/var/www/stock-management` | 存在 |
| `/opt/stock-management/server` | 存在 |
| `/var/www/stock-management/web/dist` | 存在 |
| `/opt/stock-management/server/uploads` | 存在 |
| `.env.production` | 存在 |
| PM2 | `kuwanyubeiqi-server` 两个实例 online |
| PM2 cwd | `/opt/stock-management/server` |
| PM2 script | `/opt/stock-management/server/src/app.js` |
| Nginx 配置检查 | pass |
| 后端健康检查 | `code=200` |

## env 键名存在性

以下关键键名均存在：

- `NODE_ENV`
- `PORT`
- `DB_DIALECT`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_REFRESH_EXPIRES_IN`

## 发现的问题

1. 生产部署目录不是 Git 工作树。
   - `/var/www/stock-management`、`/opt/stock-management`、`/opt/stock-management/server` 均未发现 `.git`。
   - 当前无法通过服务器目录直接追踪部署 commit。
   - 后续部署需要记录版本文件，例如 `release-version.json`，或调整为 Git/CI 拉取部署。

2. 生产 env 只检查了键名存在性。
   - 本次不读取密钥原文，因此未判断 JWT secret 强度。
   - 新增的 `npm run env:check:production -- .env.production` 需要在下一次部署新代码后于服务器执行。

## 下一步

1. 发布前在服务器部署新代码。
2. 部署后执行生产 env 校验脚本。
3. 在发布包中增加版本追踪文件，解决生产版本不可追溯问题。
