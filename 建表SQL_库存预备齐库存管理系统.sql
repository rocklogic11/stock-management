-- 酷玩预备齐库存管理系统 - 建表SQL脚本
-- 数据库类型：MySQL 5.7+
-- 字符集：utf8mb4
-- 存储引擎：InnoDB

-- 1. 用户表（user）
CREATE TABLE `user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` varchar(50) NOT NULL COMMENT '用户名（登录名）',
  `password` varchar(255) NOT NULL COMMENT '密码（加密存储）',
  `real_name` varchar(50) DEFAULT NULL COMMENT '真实姓名',
  `phone` varchar(20) DEFAULT NULL COMMENT '手机号',
  `role_id` bigint(20) NOT NULL COMMENT '角色ID',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1=正常，0=禁用）',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role_id` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 2. 角色表（role）
CREATE TABLE `role` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `role_name` varchar(50) NOT NULL COMMENT '角色名称（如"店主"、"店员"）',
  `permissions` json DEFAULT NULL COMMENT '权限配置（JSON格式）',
  `description` varchar(255) DEFAULT NULL COMMENT '角色描述',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_role_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表';

-- 3. 商品分类表（category）
CREATE TABLE `category` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '分类ID',
  `category_name` varchar(50) NOT NULL COMMENT '分类名称',
  `parent_id` bigint(20) DEFAULT '0' COMMENT '父分类ID（0=一级分类）',
  `sort_order` int(11) NOT NULL DEFAULT '0' COMMENT '排序号',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1=正常，0=禁用）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品分类表';

-- 4. 商品表（product）
CREATE TABLE `product` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  `sku_code` varchar(50) NOT NULL COMMENT '商品SKU编码（如KW-TOY-001）',
  `product_name` varchar(100) NOT NULL COMMENT '商品名称',
  `category_id` bigint(20) NOT NULL COMMENT '分类ID',
  `cost_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '加权平均成本',
  `retail_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '零售价',
  `stock_quantity` int(11) NOT NULL DEFAULT '0' COMMENT '当前库存数量',
  `barcode` varchar(100) DEFAULT NULL COMMENT '商品包装条形码/二维码内容',
  `qr_code` varchar(255) DEFAULT NULL COMMENT '二维码图片路径',
  `images` text DEFAULT NULL COMMENT '商品图片JSON数组，最多4张',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1=正常，0=下架）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sku_code` (`sku_code`),
  UNIQUE KEY `uniq_product_barcode` (`barcode`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_product_name` (`product_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- 5. 入库单表（inbound_order）
CREATE TABLE `inbound_order` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '入库单ID',
  `order_no` varchar(50) NOT NULL COMMENT '入库单号（如RK-20260428-001）',
  `user_id` bigint(20) NOT NULL COMMENT '操作人ID',
  `total_quantity` int(11) NOT NULL DEFAULT '0' COMMENT '总数量',
  `total_amount` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '总金额',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1=已完成，2=草稿）',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入库单表';

-- 6. 入库单明细表（inbound_order_item）
CREATE TABLE `inbound_order_item` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  `order_id` bigint(20) NOT NULL COMMENT '入库单ID',
  `product_id` bigint(20) NOT NULL COMMENT '商品ID',
  `quantity` int(11) NOT NULL DEFAULT '0' COMMENT '入库数量',
  `unit_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '进货单价',
  `total_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '总价（数量×单价）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入库单明细表';

-- 7. 盘点单表（inventory_order）
CREATE TABLE `inventory_order` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '盘点单ID',
  `order_no` varchar(50) NOT NULL COMMENT '盘点单号（如PD-20260428-001）',
  `user_id` bigint(20) NOT NULL COMMENT '盘点人ID',
  `audit_user_id` bigint(20) DEFAULT NULL COMMENT '审核人ID',
  `inventory_type` tinyint(4) NOT NULL DEFAULT '1' COMMENT '盘点类型（1=临时盘点，2=定期盘点）',
  `inventory_scope` varchar(255) DEFAULT NULL COMMENT '盘点范围（如"全部商品"、"模型玩偶"）',
  `total_quantity` int(11) NOT NULL DEFAULT '0' COMMENT '盘点总数量',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1=盘点中，2=待审核，3=已完成）',
  `audit_status` tinyint(4) DEFAULT NULL COMMENT '审核状态（1=通过，2=驳回）',
  `audit_opinion` varchar(255) DEFAULT NULL COMMENT '审核意见',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `audited_at` datetime DEFAULT NULL COMMENT '审核时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点单表';

-- 8. 盘点单明细表（inventory_order_item）
CREATE TABLE `inventory_order_item` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  `order_id` bigint(20) NOT NULL COMMENT '盘点单ID',
  `product_id` bigint(20) NOT NULL COMMENT '商品ID',
  `system_quantity` int(11) NOT NULL DEFAULT '0' COMMENT '系统库存数量',
  `actual_quantity` int(11) DEFAULT NULL COMMENT '实际盘点数量',
  `difference` int(11) DEFAULT NULL COMMENT '差异数量（实际-系统）',
  `difference_amount` decimal(10,2) DEFAULT NULL COMMENT '差异金额（差异数量 × 加权平均成本）',
  `status` tinyint(4) NOT NULL DEFAULT '1' COMMENT '状态（1=未盘，2=已盘）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点单明细表';

-- 9. 库存预警设置表（stock_alert_setting）
CREATE TABLE `stock_alert_setting` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '设置ID',
  `product_id` bigint(20) NOT NULL COMMENT '商品ID',
  `alert_threshold` int(11) NOT NULL DEFAULT '0' COMMENT '预警阈值',
  `is_active` tinyint(4) NOT NULL DEFAULT '1' COMMENT '是否启用（1=启用，0=禁用）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预警设置表';

-- 10. 库存流水表（stock_movement）
CREATE TABLE `stock_movement` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '流水ID',
  `product_id` bigint(20) NOT NULL COMMENT '商品ID',
  `movement_type` varchar(30) NOT NULL COMMENT 'inbound/outbound/inventory_adjust/manual_adjust',
  `quantity` int(11) NOT NULL COMMENT '变动数量，正数入库，负数出库',
  `before_quantity` int(11) NOT NULL COMMENT '变动前库存',
  `after_quantity` int(11) NOT NULL COMMENT '变动后库存',
  `unit_cost` decimal(10,2) DEFAULT NULL COMMENT '变动时成本价',
  `reference_type` varchar(30) DEFAULT NULL COMMENT '关联单据类型',
  `reference_id` bigint(20) DEFAULT NULL COMMENT '关联单据ID',
  `operator_id` bigint(20) DEFAULT NULL COMMENT '操作人ID',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_stock_movement_product_id` (`product_id`),
  KEY `idx_stock_movement_reference` (`reference_type`, `reference_id`),
  KEY `idx_stock_movement_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存流水表';

-- 11. 操作日志表（operation_log）
CREATE TABLE `operation_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id` bigint(20) NOT NULL COMMENT '操作人ID',
  `operation_type` varchar(50) NOT NULL COMMENT '操作类型（如"入库"、"盘点"、"审核"）',
  `operation_detail` text DEFAULT NULL COMMENT '操作详情（JSON格式）',
  `ip_address` varchar(50) DEFAULT NULL COMMENT '操作IP',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_operation_type` (`operation_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

-- 12. 通知表（notification）
CREATE TABLE `notification` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  `user_id` bigint(20) NOT NULL COMMENT '接收用户ID',
  `type` tinyint(4) NOT NULL COMMENT '通知类型（1=库存预警，2=盘点审核，3=审核结果，4=盘点提醒）',
  `title` varchar(100) NOT NULL COMMENT '通知标题',
  `content` varchar(500) NOT NULL COMMENT '通知内容',
  `related_id` bigint(20) DEFAULT NULL COMMENT '关联业务ID（如盘点单ID、商品ID）',
  `related_type` varchar(50) DEFAULT NULL COMMENT '关联业务类型（如"盘点单"、"商品"）',
  `is_read` tinyint(4) NOT NULL DEFAULT '0' COMMENT '是否已读（0=未读，1=已读）',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知表';

-- 插入初始数据：角色（店主、店员）
INSERT INTO `role` (`id`, `role_name`, `permissions`, `description`) VALUES
(1, '店主', '{"product_manage":true,"inbound_manage":true,"inventory_manage":true,"inventory_audit":true,"stock_query":true,"stock_value_query":true,"analytics_query":true,"alert_manage":true,"log_query":true,"permission_manage":true}', '系统管理员，拥有所有权限'),
(2, '店员', '{"product_manage":false,"inbound_manage":true,"inventory_manage":true,"inventory_audit":false,"stock_query":true,"stock_value_query":false,"analytics_query":false,"alert_manage":false,"log_query":false,"permission_manage":false}', '普通店员，部分权限');

-- 插入初始数据：管理员账号（密码：admin123，需加密存储）
INSERT INTO `user` (`id`, `username`, `password`, `real_name`, `phone`, `role_id`, `status`) VALUES
(1, 'admin', '$2b$12$EixZaYpia/10XgNbJ8FCPO1Q5QqJ5J5J5J5J5J5J5J5J5J5J5J5J', '系统管理员', '13800138000', 1, 1);

-- 插入初始数据：商品分类
INSERT INTO `category` (`id`, `category_name`, `parent_id`, `sort_order`, `status`) VALUES
(1, '模型玩偶', 0, 1, 1),
(2, '模型汽车', 0, 2, 1),
(3, '模型机器人', 0, 3, 1);
