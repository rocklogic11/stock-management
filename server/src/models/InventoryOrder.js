const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryOrder = sequelize.define('inventory_order', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  order_no: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  audit_user_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  inventory_type: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1, // 1=临时盘点, 2=定期盘点
  },
  inventory_scope: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  total_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1, // 1=盘点中, 2=待审核, 3=已完成
  },
  audit_status: {
    type: DataTypes.TINYINT,
    allowNull: true, // 1=通过, 2=驳回
  },
  audit_opinion: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  audited_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'inventory_order',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = InventoryOrder;
