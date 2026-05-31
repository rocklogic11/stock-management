const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');
const Category = require('./Category');
const Product = require('./Product');
const InboundOrder = require('./InboundOrder');
const InboundOrderItem = require('./InboundOrderItem');
const InventoryOrder = require('./InventoryOrder');
const InventoryOrderItem = require('./InventoryOrderItem');
const StockAlertSetting = require('./StockAlertSetting');
const StockMovement = require('./StockMovement');
const OperationLog = require('./OperationLog');
const Notification = require('./Notification');

// 用户 - 角色
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

// 分类 - 商品
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// 用户 - 入库单
User.hasMany(InboundOrder, { foreignKey: 'user_id', as: 'inboundOrders' });
InboundOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 入库单 - 入库明细
InboundOrder.hasMany(InboundOrderItem, { foreignKey: 'order_id', as: 'items' });
InboundOrderItem.belongsTo(InboundOrder, { foreignKey: 'order_id', as: 'order' });
InboundOrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 用户 - 盘点单
User.hasMany(InventoryOrder, { foreignKey: 'user_id', as: 'inventoryOrders' });
InventoryOrder.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
InventoryOrder.belongsTo(User, { foreignKey: 'audit_user_id', as: 'auditUser' });

// 盘点单 - 盘点明细
InventoryOrder.hasMany(InventoryOrderItem, { foreignKey: 'order_id', as: 'items' });
InventoryOrderItem.belongsTo(InventoryOrder, { foreignKey: 'order_id', as: 'order' });
InventoryOrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 商品 - 预警设置
Product.hasOne(StockAlertSetting, { foreignKey: 'product_id', as: 'alertSetting' });
StockAlertSetting.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 商品 - 库存流水
Product.hasMany(StockMovement, { foreignKey: 'product_id', as: 'stockMovements' });
StockMovement.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });
StockMovement.belongsTo(User, { foreignKey: 'operator_id', as: 'operator' });

// 用户 - 操作日志
User.hasMany(OperationLog, { foreignKey: 'user_id', as: 'operationLogs' });
OperationLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 用户 - 通知
User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = {
  sequelize,
  User,
  Role,
  Category,
  Product,
  InboundOrder,
  InboundOrderItem,
  InventoryOrder,
  InventoryOrderItem,
  StockAlertSetting,
  StockMovement,
  OperationLog,
  Notification,
};
