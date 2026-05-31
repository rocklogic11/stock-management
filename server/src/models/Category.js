const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('category', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  category_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  parent_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'category',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Category;
