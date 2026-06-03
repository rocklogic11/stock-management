# 生产发布记录 - 2026-06-03

## 发布结论

发布完成，生产系统可用。

最终上线 commit：

- `68b0ba4 fix: disable unsafe production memory cache`

生产地址：

- `http://121.40.110.240`

## 备份

备份目录：

- `/root/stock-management-backups/20260603-103954`

备份内容：

- 后端运行目录：`server.tar.gz`
- 前端静态文件：`web-dist.tar.gz`
- 实际运行 env：`server.env`
- 原 `.env.production`：`server.env.production`
- PM2 配置：`ecosystem.config.js`
- 数据库：`kuwanyubeiqi.sql`
- 校验文件：`SHA256SUMS`

数据库备份使用 `--no-tablespaces` 重新导出，最终无权限警告。

## 发布过程

1. 从 GitHub `main` 拉取代码。
2. 构建前端。
3. 同步后端代码到 `/opt/stock-management/server`。
4. 同步前端 dist 到 `/var/www/stock-management/web/dist`。
5. 生产 env 校验。
6. 执行数据库迁移。
7. 重建 PM2 进程。
8. 写入版本追踪文件：
   - `/opt/stock-management/release-version.json`
   - `/var/www/stock-management/web/dist/release-version.json`

## 生产环境治理

本次发现生产实际运行配置是 `/opt/stock-management/server/.env` 和 PM2 环境，不是 `.env.production`。

已处理：

- 统一 `.env` 与 `.env.production` 的实际数据库配置。
- 轮换 `JWT_SECRET`。
- 轮换 `JWT_REFRESH_SECRET`。
- 轮换 MySQL 用户 `kuwan_user` 的数据库密码。
- 使用 `pm2 delete` 后重新从 `ecosystem.config.js --env production` 启动，避免旧 PM2 env 继续覆盖 `.env`。

说明：

- JWT 轮换后，旧登录 token 会失效，用户需要重新登录。
- 未在文档和日志中输出任何新密钥。

## 发布中发现并修复的问题

### 1. 店员商品接口仍返回成本价

现象：

- P0 回归失败：`clerkProduct.cost_price should be filtered`。

原因：

- 商品接口把 Sequelize 实例放入 `{ items: [...] }` 后再过滤，内层实例未先转为 plain object，导致 `cost_price` 没有真正从 `dataValues` 中删除。

修复：

- `4fd5338 fix: filter product cost fields for clerks`

### 2. PM2 cluster 下内存缓存导致库存读取陈旧

现象：

- P0 回归失败：确认入库后商品库存查询仍是旧值。

原因：

- 生产 PM2 有 2 个 cluster 实例。
- 当前缓存是进程内 memory cache，一个实例清缓存无法清掉另一个实例的缓存。
- 该问题会影响商品库存、成本权限等可变数据。

修复：

- `68b0ba4 fix: disable unsafe production memory cache`
- 生产环境未启用 Redis 时禁用进程内缓存。

## 验证结果

### 服务器本机验证

| 检查 | 结果 |
| --- | --- |
| env 校验 | Passed |
| 数据库迁移 | Passed |
| PM2 | `kuwanyubeiqi-server` 两个实例 online |
| Nginx | `nginx -t` Passed |
| 本机 release smoke | Passed |
| 本机 P0 regression | Passed |

### 外网验证

| 检查 | 结果 |
| --- | --- |
| `http://121.40.110.240` release smoke | Passed |
| PC UI smoke | Passed |
| Mobile viewport UI smoke | Passed |

## 上线后观察

观察方式：

- 10 轮采样。
- 每轮间隔 30 秒。
- 覆盖健康检查、登录、分类、商品列表、PM2 状态。

结果：

| 轮次 | Health | Login | Categories | Products | PM2 |
| --- | --- | --- | --- | --- | --- |
| 1 | 209ms | 455ms | 51ms / 6 | 91ms / 14 | online |
| 2 | 80ms | 452ms | 51ms / 6 | 61ms / 14 | online |
| 3 | 88ms | 442ms | 48ms / 6 | 66ms / 14 | online |
| 4 | 78ms | 437ms | 48ms / 6 | 63ms / 14 | online |
| 5 | 72ms | 448ms | 51ms / 6 | 60ms / 14 | online |
| 6 | 72ms | 442ms | 48ms / 6 | 70ms / 14 | online |
| 7 | 75ms | 443ms | 48ms / 6 | 69ms / 14 | online |
| 8 | 73ms | 440ms | 51ms / 6 | 58ms / 14 | online |
| 9 | 77ms | 449ms | 48ms / 6 | 65ms / 14 | online |
| 10 | 86ms | 460ms | 51ms / 6 | 59ms / 14 | online |

失败数：

- `0`

## 剩余事项

1. 生产仍是 HTTP over IP，iOS 实时扫码长期需要正式 HTTPS 域名。
2. 当前未启用 Redis，生产内存缓存已禁用；后续如需缓存，应接入 Redis。
3. 本次是手动发布，后续需要 CI/CD 自动化。
4. 需要用户执行 iOS 真机 UAT：登录、新增商品、实时扫码、拍照识别、上传 1-4 张图片。
