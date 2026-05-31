const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockAlertSetting = sequelize.define('stock_alert_setting', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  product_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  alert_threshold: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  is_active: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'stock_alert_setting',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = StockAlertSetting;
