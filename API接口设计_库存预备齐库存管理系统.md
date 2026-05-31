# API接口设计文档 - 库存预备齐库存管理系统

## 一、API概述

### 1.1 基本信息
- **API版本**：v1.0
| **协议**：HTTP
- **域名**：`http://121.40.110.240`（生产环境，阿里云 ECS）
- **Base URL**：`/api/v1`
- **数据格式**：JSON
- **字符编码**：UTF-8

### 1.2 认证方式
- **认证方式**：JWT（JSON Web Token）
- **Token传递**：HTTP Header
  ```
  Authorization: Bearer {token}
  ```
- **Token有效期**：24小时（可配置）
- **刷新Token**：支持（有效期7天）

### 1.3 通用响应格式
**成功响应**：
```json
{
  "code": 200,
  "message": "success",
  "data": {...}
}
```

**失败响应**：
```json
{
  "code": 400,
  "message": "错误描述",
  "errors": [...]
}
```

### 1.4 通用错误码
| 错误码 | 说明 |
|-------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（Token无效或过期） |
| 403 | 无权限（权限不足） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
| 1001 | 商品不存在 |
| 1002 | 库存不足 |
| 1003 | 入库单不存在 |
| 1004 | 盘点单不存在 |
| 1005 | 盘点单状态不允许此操作 |
| 1006 | 旧密码错误 |
| 1007 | 新密码不符合要求 |

---

## 二、API接口清单

### 2.1 认证模块（3个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 用户登录 | POST | `/auth/login` | 使用用户名+密码登录，返回Token |
| 刷新Token | POST | `/auth/refresh` | 使用刷新Token获取新的访问Token |
| 获取当前用户信息 | GET | `/auth/me` | 获取当前登录用户信息（角色、权限） |

---

### 2.2 用户管理模块（5个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取用户列表 | GET | `/users` | 分页查询用户列表 |
| 创建用户 | POST | `/users` | 新增用户（店主操作） |
| 更新用户 | PUT | `/users/{id}` | 更新用户信息 |
| 删除用户 | DELETE | `/users/{id}` | 删除用户（禁用，非物理删除） |
| 修改密码 | PUT | `/users/{id}/password` | 修改用户密码（需验证旧密码） |

---

### 2.3 角色权限模块（3个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取角色列表 | GET | `/roles` | 查询所有角色 |
| 创建角色 | POST | `/roles` | 新增角色（可自定义权限） |
| 更新角色 | PUT | `/roles/{id}` | 更新角色权限 |

---

### 2.4 商品分类模块（4个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取分类列表 | GET | `/categories` | 查询分类（支持树形结构） |
| 创建分类 | POST | `/categories` | 新增分类 |
| 更新分类 | PUT | `/categories/{id}` | 更新分类信息 |
| 删除分类 | DELETE | `/categories/{id}` | 删除分类（需无关联商品） |

---

### 2.5 商品管理模块（6个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取商品列表 | GET | `/products` | 分页查询商品列表（支持搜索、筛选） |
| 获取商品详情 | GET | `/products/{id}` | 查询单个商品详情 |
| 创建商品 | POST | `/products` | 新增商品（系统自动生成SKU） |
| 更新商品 | PUT | `/products/{id}` | 更新商品信息 |
| 删除商品 | DELETE | `/products/{id}` | 下架商品（非物理删除） |
| 生成二维码 | POST | `/products/{id}/qrcode` | 为商品生成二维码（返回图片URL） |

---

### 2.6 入库管理模块（6个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取入库单列表 | GET | `/inbound-orders` | 分页查询入库单列表 |
| 获取入库单详情 | GET | `/inbound-orders/{id}` | 查询单个入库单详情（含明细） |
| 创建入库单 | POST | `/inbound-orders` | 新增入库单（含明细） |
| 更新入库单 | PUT | `/inbound-orders/{id}` | 更新入库单（仅草稿状态可更新） |
| 删除入库单 | DELETE | `/inbound-orders/{id}` | 删除入库单（仅草稿状态可删除） |
| 完成入库 | POST | `/inbound-orders/{id}/complete` | 提交入库，更新库存数量 |

---

### 2.7 盘点管理模块（8个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取盘点单列表 | GET | `/inventory-orders` | 分页查询盘点单列表 |
| 获取盘点单详情 | GET | `/inventory-orders/{id}` | 查询单个盘点单详情（含明细） |
| 创建盘点单 | POST | `/inventory-orders` | 新增盘点单（含明细，初始状态为"盘点中"） |
| 更新盘点单 | PUT | `/inventory-orders/{id}` | 更新盘点单（仅"盘点中"状态可更新） |
| 扫码盘点 | POST | `/inventory-orders/{id}/scan` | 扫码添加盘点商品（自动累加数量） |
| 提交盘点 | POST | `/inventory-orders/{id}/submit` | 提交盘点，状态变为"待审核" |
| 审核盘点 | POST | `/inventory-orders/{id}/audit` | 审核盘点单（通过/驳回） |
| 删除盘点单 | DELETE | `/inventory-orders/{id}` | 删除盘点单（仅"盘点中"状态可删除） |

---

### 2.8 库存查询模块（4个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取实时库存 | GET | `/stock` | 查询当前库存列表（支持搜索、筛选） |
| 获取库存详情 | GET | `/stock/{product_id}` | 查询单个商品库存详情 |
| 获取库存价值统计 | GET | `/stock/value-statistics` | 按成本价和零售价统计库存价值 |
| 获取库存变动记录 | GET | `/stock/{product_id}/history` | 查询商品库存变动记录（入库、出库、盘点） |

---

### 2.9 智能分析模块（4个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取库存预警列表 | GET | `/analytics/stock-alerts` | 查询低于预警阈值的商品 |
| 获取进货建议 | GET | `/analytics/purchase-suggestions` | 根据销售速度和库存计算建议进货量 |
| 获取销售统计 | GET | `/analytics/sales-statistics` | 查询销售数据统计（需对接客如云） |
| 获取热销/滞销商品 | GET | `/analytics/top-products` | 查询热销榜和滞销榜 |

---

### 2.10 操作日志模块（1个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取操作日志 | GET | `/operation-logs` | 分页查询操作日志列表（支持按用户、类型、时间筛选） |

---

### 2.11 站内消息通知模块（4个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取通知列表 | GET | `/notifications` | 分页查询当前用户的通知列表 |
| 获取未读数量 | GET | `/notifications/unread-count` | 获取当前用户未读通知数量 |
| 标记已读 | PUT | `/notifications/{id}/read` | 将指定通知标记为已读 |
| 全部标记已读 | PUT | `/notifications/read-all` | 将当前用户所有通知标记为已读 |

---

### 2.12 首页仪表盘模块（1个接口）

| 接口名称 | 请求方法 | URL | 描述 |
|---------|---------|-----|------|
| 获取仪表盘数据 | GET | `/dashboard` | 获取首页仪表盘统计数据（库存总值、预警数等） |

---

## 三、核心接口详细说明

### 3.1 用户登录
- **接口**：`POST /auth/login`
- **描述**：使用用户名+密码登录，返回Token
- **请求参数**：
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expires_in": 86400,
      "user": {
        "id": 1,
        "username": "admin",
        "real_name": "系统管理员",
        "role": "店主"
      }
    }
  }
  ```

---

### 3.2 创建商品
- **接口**：`POST /products`
- **描述**：新增商品，系统自动生成SKU编码
- **请求参数**：
  ```json
  {
    "product_name": "钢铁侠模型玩偶",
    "category_id": 1,
    "cost_price": 150.00,
    "retail_price": 300.00,
    "stock_threshold": 5,
    "image_url": "http://121.40.110.240/uploads/products/iron-man.jpg"
  }
  ```
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "id": 1,
      "sku_code": "KW-TOY-001",
      "product_name": "钢铁侠模型玩偶",
      "category_id": 1,
      "cost_price": 150.00,
      "retail_price": 300.00,
      "stock_quantity": 0,
      "stock_threshold": 5,
      "status": 1,
      "created_at": "2026-04-28 20:00:00"
    }
  }
  ```

---

### 3.3 创建入库单
- **接口**：`POST /inbound-orders`
- **描述**：新增入库单，包含多个商品明细
- **请求参数**：
  ```json
  {
    "items": [
      {
        "product_id": 1,
        "quantity": 10,
        "unit_price": 150.00
      },
      {
        "product_id": 2,
        "quantity": 8,
        "unit_price": 120.00
      }
    ],
    "remark": "第一批进货"
  }
  ```
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "id": 1,
      "order_no": "RK-20260428-001",
      "total_quantity": 18,
      "total_amount": 2940.00,
      "status": 1,
      "created_at": "2026-04-28 20:30:00"
    }
  }
  ```

---

### 3.4 扫码盘点
- **接口**：`POST /inventory-orders/{id}/scan`
- **描述**：扫码添加盘点商品，系统自动累加数量
- **请求参数**：
  ```json
  {
    "sku_code": "KW-TOY-001"
  }
  ```
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "product_id": 1,
      "product_name": "钢铁侠模型玩偶",
      "system_quantity": 25,
      "scanned_quantity": 5,
      "Difference": null
    }
  }
  ```

---

### 3.5 获取库存预警列表
- **接口**：`GET /analytics/stock-alerts`
- **描述**：查询低于预警阈值的商品
- **请求参数**：
  - `page`：页码（默认1）
  - `page_size`：每页数量（默认20）
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "total": 8,
      "items": [
        {
          "product_id": 3,
          "sku_code": "KW-TOY-003",
          "product_name": "蝙蝠侠模型玩偶",
          "current_stock": 2,
          "alert_threshold": 5,
          "daily_sales": 3,
          "days_of_supply": 0.7,
          "suggested_quantity": 13
        }
      ]
    }
  }
  ```

---

### 3.6 获取当前用户信息
- **接口**：`GET /auth/me`
- **描述**：获取当前登录用户信息，包括角色和权限
- **请求头**：`Authorization: Bearer {token}`
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "id": 1,
      "username": "admin",
      "real_name": "张店主",
      "phone": "13800138000",
      "role": {
        "id": 1,
        "role_name": "店主",
        "permissions": {
          "product_manage": true,
          "inbound_manage": true,
          "inventory_manage": true,
          "inventory_audit": true,
          "stock_query": true,
          "stock_value_query": true,
          "analytics_query": true,
          "alert_manage": true,
          "log_query": true,
          "permission_manage": true
        }
      }
    }
  }
  ```

---

### 3.7 修改密码
- **接口**：`PUT /users/{id}/password`
- **描述**：修改用户密码，需验证旧密码
- **请求参数**：
  ```json
  {
    "old_password": "admin123",
    "new_password": "newpass456"
  }
  ```
- **密码规则**：
  - 最少6个字符
  - 必须包含字母和数字
  - 新密码不能与旧密码相同
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "密码修改成功"
  }
  ```
- **错误响应**：
  ```json
  {
    "code": 1006,
    "message": "旧密码错误"
  }
  ```

---

### 3.8 获取通知列表
- **接口**：`GET /notifications`
- **描述**：分页查询当前用户的通知列表
- **请求参数**：
  - `page`：页码（默认1）
  - `page_size`：每页数量（默认20）
  - `type`：通知类型筛选（1=库存预警，2=盘点审核，3=审核结果，4=盘点提醒，不传则查全部）
  - `is_read`：是否已读筛选（0=未读，1=已读，不传则查全部）
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "total": 8,
      "page": 1,
      "page_size": 20,
      "items": [
        {
          "id": 1,
          "type": 1,
          "type_name": "库存预警",
          "title": "库存预警提醒",
          "content": "蝙蝠侠模型玩偶当前库存2件，低于预警阈值5件",
          "related_id": 3,
          "related_type": "商品",
          "is_read": 0,
          "created_at": "2026-04-29 08:00:00"
        }
      ]
    }
  }
  ```

---

### 3.9 获取未读通知数量
- **接口**：`GET /notifications/unread-count`
- **描述**：获取当前用户未读通知数量（用于导航栏红点显示）
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "unread_count": 3
    }
  }
  ```

---

### 3.10 标记通知已读
- **接口**：`PUT /notifications/{id}/read`
- **描述**：将指定通知标记为已读
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "标记成功"
  }
  ```

---

### 3.11 全部标记已读
- **接口**：`PUT /notifications/read-all`
- **描述**：将当前用户所有通知标记为已读
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "全部标记已读成功"
  }
  ```

---

### 3.12 获取仪表盘数据
- **接口**：`GET /dashboard`
- **描述**：获取首页仪表盘统计数据
- **响应示例**：
  ```json
  {
    "code": 200,
    "message": "success",
    "data": {
      "total_cost_value": 125000.00,
      "total_retail_value": 250000.00,
      "product_count": 56,
      "alert_count": 8,
      "today_inbound_quantity": 45,
      "pending_audit_count": 2,
      "recent_operations": [
        {
          "id": 101,
          "operation_type": "入库",
          "operation_detail": "入库单 RK-20260429-001，入库钢铁侠 x 10",
          "operator": "李明",
          "created_at": "2026-04-29 08:30:00"
        }
      ]
    }
  }
  ```
- **权限说明**：
  - 店主：可查看所有数据
  - 店员：仅查看 product_count、today_inbound_quantity，其他字段返回0或空

---

## 四、分页参数规范

### 4.1 请求参数
- `page`：页码（从1开始，默认1）
- `page_size`：每页数量（默认20，最大100）

### 4.2 响应格式
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5,
    "items": [...]
  }
}
```

---

## 五、后续工作

1. **API文档工具**：建议使用Swagger/OpenAPI 3.0 生成在线API文档
2. **接口测试**：使用Postman或Insomnia进行接口测试
3. **接口Mock**：前后端分离开发时，可使用Mock.js模拟接口数据

---

**下一步**：设计阶段全部完成，可进入开发阶段（前后端开发）。
