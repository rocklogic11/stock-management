const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OperationLog = sequelize.define('operation_log', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  operation_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  operation_detail: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'operation_log',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = OperationLog;
