const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('product', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  sku_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  product_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  category_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  cost_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  retail_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  stock_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true,
    comment: '商品包装上的二维码/条码内容',
  },
  qr_code: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  images: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '商品图片JSON数组，最多4张',
    get() {
      const val = this.getDataValue('images');
      return val ? JSON.parse(val) : [];
    },
    set(val) {
      this.setDataValue('images', val ? JSON.stringify(val) : null);
    },
  },
  image_url: {
    type: DataTypes.VIRTUAL,
    get() {
      const imgs = this.images || [];
      return imgs.length > 0 ? imgs[0] : null;
    },
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
}, {
  tableName: 'product',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Product;
