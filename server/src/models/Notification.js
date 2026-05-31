const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('notification', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  type: {
    type: DataTypes.TINYINT,
    allowNull: false, // 1=库存预警, 2=盘点审核, 3=审核结果, 4=盘点提醒
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  content: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  related_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  related_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  is_read: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: 'notification',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Notification;
