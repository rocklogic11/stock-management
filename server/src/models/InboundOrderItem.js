const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InboundOrderItem = sequelize.define('inbound_order_item', {
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
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  unit_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
}, {
  tableName: 'inbound_order_item',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = InboundOrderItem;
