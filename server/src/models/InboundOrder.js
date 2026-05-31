const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InboundOrder = sequelize.define('inbound_order', {
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
  total_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 2, // 1=已完成, 2=草稿
  },
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'inbound_order',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = InboundOrder;
