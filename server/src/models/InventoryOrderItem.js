const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InventoryOrderItem = sequelize.define('inventory_order_item', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  order_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  product_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  system_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  actual_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  difference: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  difference_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1, // 1=未盘, 2=已盘
  },
}, {
  tableName: 'inventory_order_item',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = InventoryOrderItem;
