# 库存预备齐 - 库存管理系统

> 一套面向潮玩/玩具零售店的库存管理系统，支持扫码入库、盘点、库存预警等功能。

## 技术栈

- **后端**：Node.js + Express + Sequelize + MySQL + JWT
- **前端**：Vue 3 + Element Plus + Vite + Pinia
- **多端**：响应式设计，同时支持PC和手机端

## 快速开始

### 1. 环境要求

- Node.js 18+
- MySQL 5.7+ / 8.0+

### 2. 配置数据库

修改 `server/.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=kuwanyubeiqi
DB_USER=root
DB_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

### 3. 初始化数据库

```bash
cd server
npm install
npm run init-db
```

### 4. 启动后端

```bash
cd server
npm run dev
```

后端运行在 http://localhost:3000

### 5. 启动前端

```bash
cd web
npm install
npm run dev
```

前端运行在 http://localhost:5173

### 6. 访问系统

打开浏览器访问 http://localhost:5173

默认账号：
- 店主：admin / admin123
- 店员：clerk / clerk123

## 功能模块

| 模块 | 功能 |
|------|------|
| 首页仪表盘 | 库存总值、商品种类、预警数、今日入库量、待审核盘点单、最近操作 |
| 商品管理 | 商品CRUD、SKU自动生成、二维码生成与打印 |
| 入库管理 | 入库单创建、确认入库、加权平均成本计算 |
| 盘点管理 | 盘点单创建、扫码盘点、提交审核、审核通过/驳回 |
| 库存查询 | 实时库存查询、库存金额统计 |
| 智能分析 | 库存预警、进货建议 |
| 站内消息 | 预警通知、审核通知、审核结果通知 |
| 系统管理 | 操作日志、权限管理（角色可配置） |
| 数据导出 | Excel导出（库存、入库、盘点、日志） |

## 项目结构

```
stockManagement/
├── server/                    # 后端
│   ├── src/
│   │   ├── config/           # 配置
│   │   ├── middleware/       # 中间件（JWT认证）
│   │   ├── models/           # Sequelize数据模型（11张表）
│   │   ├── routes/           # API路由
│   │   ├── scripts/          # 初始化脚本
│   │   ├── utils/            # 工具函数
│   │   └── app.js            # 主入口
│   └── package.json
├── web/                      # 前端
│   ├── src/
│   │   ├── assets/           # 静态资源
│   │   ├── router/           # 路由
│   │   ├── stores/           # Pinia状态管理
│   │   ├── utils/            # 工具函数
│   │   ├── views/            # 页面组件
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── docs/                     # 设计文档
    ├── PRD
    ├── 场景分析
    ├── 功能清单
    ├── 数据库设计
    ├── API接口设计
    └── 建表SQL
```
