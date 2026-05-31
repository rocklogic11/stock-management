# 库存预备齐 - 库存管理系统

> 面向潮玩/玩具零售店的库存管理系统，支持扫码入库、盘点、库存预警等功能。
>
> **线上地址**：http://121.40.110.240
>
> **当前状态**：✅ 已上线运行（V1.0 MVP）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express + Sequelize ORM + MySQL/SQLite |
| 前端 | Vue 3 + Element Plus + Vite + Pinia + Vue Router |
| 缓存 | Redis (生产) / NodeCache 内存缓存 (开发降级) |
| 部署 | PM2 + Nginx 反向代理 (阿里云 ECS) |
| 认证 | JWT Token + bcryptjs 密码加密 |

---

## 功能模块

| 模块 | 功能 |
|------|------|
| 首页仪表盘 | 库存总值(成本价/零售价)、商品种类、预警数、今日入库量、待审核盘点单、最近操作 |
| 商品管理 | 商品CRUD、SKU自动生成(KW-TOY-XXX)、二维码生成与打印 |
| 入库管理 | 入库单创建、扫码添加商品、确认入库、加权平均成本计算 |
| 盘点管理 | 盘点单创建、扫码盘点、提交审核、审核通过/驳回/部分通过 |
| 库存查询 | 实时库存查询、库存金额统计(成本价+零售价) |
| 智能分析 | 库存预警列表、进货建议 |
| 站内消息 | 预警通知、审核通知、审核结果通知、未读消息计数 |
| 系统管理 | 操作日志查看、权限管理(角色可配置)、修改密码 |
| 数据导出 | Excel导出(库存、入库、盘点、日志) |

---

## 项目结构

```
stockManagement/
├── server/                      # 后端服务 (Node.js/Express)
│   ├── src/
│   │   ├── app.js               # 主入口
│   │   ├── config/              # 配置(端口/JWT/数据库双模式)
│   │   ├── middleware/          # JWT认证中间件
│   │   ├── models/              # Sequelize数据模型(11张表)
│   │   │   ├── User.js          # 用户模型
│   │   │   ├── Role.js          # 角色模型
│   │   │   ├── Category.js      # 分类模型
│   │   │   ├── Product.js       # 商品模型
│   │   │   ├── InboundOrder.js  # 入库单模型
│   │   │   ├── InboundOrderItem.js  # 入库单明细
│   │   │   ├── InventoryOrder.js    # 盘点单模型
│   │   │   ├── InventoryOrderItem.js # 盘点明细
│   │   │   ├── StockAlertSetting.js # 预警设置
│   │   │   ├── StockMovement.js     # 库存流水
│   │   │   ├── OperationLog.js      # 操作日志
│   │   │   └── Notification.js      # 通知消息
│   │   ├── routes/              # API路由(14个模块)
│   │   ├── utils/               # 工具函数(缓存/分页/SKU生成等)
│   │   └── scripts/init-db.js   # 数据库初始化脚本
│   ├── ecosystem.config.js      # PM2集群模式配置
│   └── package.json
├── web/                          # 前端应用 (Vue 3)
│   ├── src/
│   │   ├── main.js              # 应用入口
│   │   ├── App.vue              # 根组件
│   │   ├── router/index.js      # 路由定义(含登录守卫)
│   │   ├── stores/user.js       # Pinia状态管理
│   │   ├── utils/request.js     # Axios封装
│   │   ├── views/               # 页面组件(12个)
│   │   │   ├── Login.vue        # 登录页
│   │   │   ├── Layout.vue       # 主布局
│   │   │   ├── Dashboard.vue    # 经营驾驶舱
│   │   │   ├── Products.vue     # 商品档案
│   │   │   ├── InboundOrders.vue # 扫码入库
│   │   │   ├── InventoryOrders.vue # 扫码盘点
│   │   │   ├── StockQuery.vue   # 库存查询
│   │   │   ├── StockAlerts.vue  # 预警与补货
│   │   │   ├── PurchaseSuggestion.vue # 进货建议
│   │   │   ├── OperationLogs.vue # 操作日志
│   │   │   ├── Permissions.vue  # 权限管理
│   │   │   └── Notifications.vue # 消息通知
│   │   └── assets/global.css    # 全局样式
│   └── package.json
├── docker/                      # Docker配置
│   ├── docker-compose.yml
│   ├── backend/Dockerfile
│   ├── frontend/Dockerfile
│   └── nginx/nginx.conf
├── scripts/                     # 工具脚本
│   ├── deploy.sh                # Linux部署
│   ├── deploy.ps1               # Windows部署
│   ├── backup-db.sh             # 数据库备份(Linux)
│   └── backup-db.ps1            # 数据库备份(Windows)
└── docs/                        # 设计文档(见下方文档清单)
```

---

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+ (或 SQLite 开发模式)

### 本地开发

```bash
# 1. 后端
cd server
npm install
cp .env.example .env   # 配置数据库连接
npm run init-db         # 初始化数据库
npm run dev             # 启动开发服务器 (端口3000)

# 2. 前端 (新终端)
cd web
npm install
npm run dev             # 启动开发服务器 (端口5173)
```

### 访问系统

打开浏览器访问 http://localhost:5173

**默认账号**：
- 店主：`admin` / `admin123`
- 店员：`clerk` / `clerk123`

---

## 线上环境

| 项目 | 详情 |
|------|------|
| 服务器 | 阿里云 ECS |
| IP 地址 | 121.40.110.240 |
| 线上地址 | http://121.40.110.240 |
| 部署路径 | `/var/www/stock-management/web/dist` |
| 后端进程 | PM2 管理 (端口 3000) |
| 反向代理 | Nginx (80端口) |
| 数据库 | MySQL (本地) |
| 缓存 | Redis (本地) |

---

## API 接口

基础路径: `/api/v1`

| 模块 | 接口数 | 说明 |
|------|--------|------|
| 认证 | 3 | 登录/刷新Token/获取用户信息 |
| 用户管理 | 5 | 用户CRUD/修改密码 |
| 角色权限 | 3 | 角色CRUD |
| 商品分类 | 4 | 分类CRUD |
| 商品管理 | 6 | 商品CRUD/二维码生成 |
| 入库管理 | 6 | 入库单CRUD/确认入库 |
| 盘点管理 | 8 | 盘点单CRUD/扫码/提交/审核 |
| 库存查询 | 4 | 实时库存/详情/价值统计/变动记录 |
| 智能分析 | 4 | 预警/进货建议/销售统计/热销滞销 |
| 操作日志 | 1 | 日志查询 |
| 站内消息 | 4 | 列表/未读数/标记已读/全部已读 |
| 仪表盘 | 1 | 统计数据 |
| **合计** | **49** | |

详细接口文档见 [API接口设计_库存预备齐库存管理系统.md](./API接口设计_库存预备齐库存管理系统.md)

---

## 数据库设计

共 **11 张表**：user, role, category, product, inbound_order, inbound_order_item, inventory_order, inventory_order_item, stock_alert_setting, operation_log, notification

完整 ER 图和建表 SQL 见 [数据库设计_库存预备齐库存管理系统.md](./数据库设计_库存预备齐库存管理系统.md) 和 [建表SQL_库存预备齐库存管理系统.sql](./建表SQL_库存预备齐库存管理系统.sql)

---

## 文档清单

| 文档 | 说明 |
|------|------|
| [PRD_库存预备齐库存管理系统.md](./PRD_库存预备齐库存管理系统.md) | 产品需求文档(MVP v1.0) |
| [功能清单_库存预备齐库存管理系统.md](./功能清单_库存预备齐库存管理系统.md) | 功能架构图 + 60个功能点清单 |
| [场景分析_库存预备齐库存管理系统.md](./场景分析_库存预备齐库存管理系统.md) | 16个业务场景详细分析 |
| [API接口设计_库存预备齐库存管理系统.md](./API接口设计_库存预备齐库存管理系统.md) | 49个API接口详细说明 |
| [数据库设计_库存预备齐库存管理系统.md](./数据库设计_库存预备齐库存管理系统.md) | ER图 + 11张表结构设计 |
| [建表SQL_库存预备齐库存管理系统.sql](./建表SQL_库存预备齐库存管理系统.sql) | MySQL建表SQL脚本 |
| [SIT测试报告_库存预备齐库存管理系统.md](./SIT测试报告_库存预备齐库存管理系统.md) | SIT系统集成测试(48/48通过) |
| [前端联调测试报告_库存预备齐库存管理系统.md](./前端联调测试报告_库存预备齐库存管理系统.md) | 前端联调测试报告 |
| [性能测试报告_库存预备齐库存管理系统.md](./性能测试报告_库存预备齐库存管理系统.md) | 性能测试报告 |
| [异常场景测试报告_库存预备齐库存管理系统.md](./异常场景测试报告_库存预备齐库存管理系统.md) | 异常场景测试 |
| [深度优化报告_库存预备齐库存管理系统.md](./深度优化报告_库存预备齐库存管理系统.md) | 性能深度优化报告 |
| [缓存优化报告_库存预备齐库存管理系统.md](./缓存优化报告_库存预备齐库存管理系统.md) | Redis缓存优化方案 |
| DEPLOYMENT_GUIDE.md | 详细部署指南 |
| DOCKER_DEPLOYMENT.md | Docker容器化部署指南 |
| DEPLOYMENT_SUMMARY.md | 部署方案总结(3种方式) |
| DEPLOYMENT_CHECKLIST.md | 部署前检查清单 |

---

## 部署方式

支持 **3 种部署方式**（详见 DEPLOYMENT_SUMMARY.md）：

1. **直接部署**（推荐生产）- Nginx + PM2
2. **Docker 部署**（推荐云环境）- Docker Compose 一键启动
3. **简化部署**（快速演示）- 直接 node 启动

---

## 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v1.1 | 2026-05-31 | 项目整理：文档统一命名(库存预备齐)、清理临时文件、修正过时配置、Git初始化、推送到 GitHub |
| v1.0 | 2026-04-28 ~ 2026-05-13 | MVP版本完成，包含12个功能模块，49个API接口，已上线阿里云 |

---

## 开源仓库

- **GitHub**: https://github.com/rocklogic11/stock-management
- **License**: MIT
