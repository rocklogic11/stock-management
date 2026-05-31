const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockMovement = sequelize.define('stock_movement', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  product_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  movement_type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    comment: 'inbound/outbound/inventory_adjust/manual_adjust',
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '变动数量，正数为入库，负数为出库',
  },
  before_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '变动前库存',
  },
  after_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: '变动后库存',
  },
  unit_cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '变动时成本价',
  },
  reference_type: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: '关联单据类型：inbound_order/inventory_order/manual',
  },
  reference_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '关联单据ID',
  },
  operator_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: '操作人ID',
  },
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'stock_movement',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = StockMovement;
