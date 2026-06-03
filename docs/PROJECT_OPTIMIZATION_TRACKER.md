# 库存预备齐项目优化销项清单

更新时间：2026-06-03

## 状态说明

| 状态 | 含义 |
| --- | --- |
| Done | 已完成，已有代码/文档/测试证据 |
| Doing | 当前正在执行 |
| Pending | 未开始 |
| Blocked | 受外部条件阻塞 |
| Need UAT | 需要用户或真实设备验收 |

## 当前结论

P0 已完成并推送到 GitHub `main`，当前进入 P1：生产环境治理、发布测试门禁、上线准备和移动端体验稳定性。

当前最新提交：

- `ecd8100 fix: address p0 inventory and security issues`

## 总体实施路线

| 阶段 | 优先级 | 目标 | 状态 | 证据/输出 |
| --- | --- | --- | --- | --- |
| P0 | 最高 | 修复账实一致性、安全配置、敏感字段泄露 | Done | `docs/P0_REMEDIATION_LOG_2026-06-03.md` |
| P1-1 | 高 | 生产凭据、环境变量、部署前安全治理 | Doing | 本清单；生产 env 校验脚本 |
| P1-2 | 高 | SIT/UAT/回归/冒烟测试门禁标准化 | Doing | `npm run release:check`；待新增发布门禁文档 |
| P1-3 | 高 | 上线发布、备份、回滚、生产观察 | Pending | 待执行 |
| P1-4 | 中高 | 移动端扫码、拍照、表单、弹窗体验强化 | Pending | 待执行 |
| P1-5 | 中高 | PC 端商品档案、首页驾驶舱、导航结构优化 | Pending | 待执行 |
| P2 | 中 | CI/CD、监控、日志、审计、性能、安全扫描 | Pending | 待执行 |
| P3 | 中低 | PWA/离线、复杂报表、长期产品能力建设 | Pending | 待排期 |

## P0 销项

| 编号 | 优化项 | 状态 | 完成时间 | 证据 |
| --- | --- | --- | --- | --- |
| P0-01 | 盘点审核使用库存快照，阻止审核时覆盖已变化库存 | Done | 2026-06-03 | `server/src/routes/inventory-orders.js`；P0 回归测试 |
| P0-02 | 入库创建与确认拆分，禁止新建时直接改库存 | Done | 2026-06-03 | `server/src/routes/inbound-orders.js`；`web/src/views/InboundOrders.vue` |
| P0-03 | 生产环境禁止默认 JWT secret | Done | 2026-06-03 | `server/src/config/index.js` |
| P0-04 | `.env.production` 从 Git 跟踪移除 | Done | 2026-06-03 | Git 提交 `ecd8100` |
| P0-05 | 店员接口敏感成本字段过滤 | Done | 2026-06-03 | `server/src/utils/permissions.js`；P0 回归测试 |
| P0-06 | P0 自动化回归测试 | Done | 2026-06-03 | `server/src/scripts/p0-regression-test.js` |

## P1 当前销项

| 编号 | 优化项 | 状态 | 责任/说明 | 输出 |
| --- | --- | --- | --- | --- |
| P1-01 | 建立项目级优化销项清单 | Done | 本次完成 | `docs/PROJECT_OPTIMIZATION_TRACKER.md` |
| P1-02 | 增加生产环境变量校验脚本 | Done | 不输出密钥值，只输出缺失/弱配置 | `server/src/scripts/validate-production-env.js` |
| P1-03 | 生产服务器环境只读核查 | Done | 已核查 PM2、部署路径、env 键名、Nginx、健康检查 | `docs/PRODUCTION_READONLY_AUDIT_2026-06-03.md` |
| P1-04 | 生产凭据轮换方案 | Done | 方案已写入；实际轮换需确认新密码/维护窗口 | `docs/PRODUCTION_ENV_GOVERNANCE.md` |
| P1-05 | 发布前 SIT/UAT/回归测试门禁文档 | Done | 覆盖 PC、iOS、扫码、图片、商品、入库、盘点、权限 | `docs/RELEASE_TEST_GATE.md` |
| P1-06 | 本地发布门禁再次执行并记录 | Done | `npm run release:check` 已通过 | 本轮本地自测 |
| P1-07 | 线上部署前备份与回滚清单 | Done | 数据库、前端、后端、PM2、Nginx | `docs/PRODUCTION_RELEASE_RUNBOOK.md` |
| P1-08 | 线上发布与观察 | Pending | 部署后健康检查、登录、分类、商品、扫码相关接口 | 待执行 |

## P1 产品体验待办

| 编号 | 优化项 | 状态 | 说明 |
| --- | --- | --- | --- |
| UX-01 | 首页驾驶舱图表化 | Pending | 将纯数字改为指标卡+趋势图+库存风险图 |
| UX-02 | 左侧导航层级优化 | Pending | 只有一个二级菜单的一级菜单建议合并 |
| UX-03 | 商品新增/编辑表单体验 | Pending | 分类加载、扫码、图片、保存状态、错误提示 |
| UX-04 | 移动端弹窗和底部操作区 | Pending | 适配 iOS 安全区、滚动、按钮固定 |
| UX-05 | PC 商品档案操作区 | Pending | 新增按钮、筛选区、表格密度、空状态 |

## P2/P3 待办

| 编号 | 优化项 | 状态 | 说明 |
| --- | --- | --- | --- |
| OPS-01 | CI/CD 自动部署流水线 | Pending | GitHub Actions 或服务器拉取部署脚本 |
| OPS-02 | 生产 HTTPS 正式域名 | Pending | iOS 实时扫码长期必须 |
| OPS-03 | 数据库自动备份与恢复演练 | Pending | 当前已有备份脚本，需纳入计划任务和演练 |
| OPS-04 | 监控与告警 | Pending | PM2、Nginx、接口可用性、磁盘、上传目录 |
| OPS-05 | 安全扫描与依赖治理 | Pending | `npm audit`、依赖升级、弱口令治理 |
| OPS-06 | PWA/离线能力 | Pending | 若要断网盘点，需要重新设计数据同步 |

## 下一步任务

下一步执行：`P1-08 线上发布与观察`。执行前先做生产备份，再部署当前 GitHub `main`。

执行原则：

1. 只读核查不修改生产配置。
2. 涉及密码轮换、数据库密码修改、PM2 重启、Nginx 修改、正式部署前，先记录操作计划和回滚路径。
3. 每完成一个任务，更新本清单状态和证据。
