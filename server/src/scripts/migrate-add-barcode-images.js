const { DataTypes } = require('sequelize');
const { sequelize } = require('../models');

async function migrate() {
  try {
    await sequelize.authenticate();
    const queryInterface = sequelize.getQueryInterface();
    const dialect = sequelize.getDialect();

    const productColumns = await queryInterface.describeTable('product');

    if (!productColumns.barcode) {
      await queryInterface.addColumn('product', 'barcode', {
        type: DataTypes.STRING(100),
        allowNull: true,
      });
      console.log('Added product.barcode');
    }

    if (!productColumns.images) {
      await queryInterface.addColumn('product', 'images', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
      console.log('Added product.images');
    }

    const duplicatedBarcodes = await sequelize.query(
      `SELECT barcode, COUNT(*) AS count FROM product WHERE barcode IS NOT NULL AND barcode != '' GROUP BY barcode HAVING COUNT(*) > 1`,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (duplicatedBarcodes.length > 0) {
      throw new Error(`Duplicate product barcode found: ${duplicatedBarcodes.map(r => r.barcode).join(', ')}`);
    }

    const indexes = await queryInterface.showIndex('product');
    const hasBarcodeIndex = indexes.some(idx => idx.name === 'uniq_product_barcode');
    if (!hasBarcodeIndex) {
      await queryInterface.addIndex('product', ['barcode'], {
        name: 'uniq_product_barcode',
        unique: true,
      });
      console.log('Added uniq_product_barcode index');
    }

    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map(t => typeof t === 'string' ? t : t.tableName || t.name);
    if (!normalizedTables.includes('stock_movement')) {
      await queryInterface.createTable('stock_movement', {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        product_id: { type: DataTypes.BIGINT, allowNull: false },
        movement_type: { type: DataTypes.STRING(30), allowNull: false },
        quantity: { type: DataTypes.INTEGER, allowNull: false },
        before_quantity: { type: DataTypes.INTEGER, allowNull: false },
        after_quantity: { type: DataTypes.INTEGER, allowNull: false },
        unit_cost: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        reference_type: { type: DataTypes.STRING(30), allowNull: true },
        reference_id: { type: DataTypes.BIGINT, allowNull: true },
        operator_id: { type: DataTypes.BIGINT, allowNull: true },
        remark: { type: DataTypes.STRING(255), allowNull: true },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: dialect === 'mysql' ? sequelize.literal('CURRENT_TIMESTAMP') : DataTypes.NOW,
        },
      });
      await queryInterface.addIndex('stock_movement', ['product_id'], { name: 'idx_stock_movement_product_id' });
      await queryInterface.addIndex('stock_movement', ['reference_type', 'reference_id'], { name: 'idx_stock_movement_reference' });
      await queryInterface.addIndex('stock_movement', ['created_at'], { name: 'idx_stock_movement_created_at' });
      console.log('Created stock_movement table');
    }

    console.log('Migration complete');
  } catch (e) {
    console.error('Migration error:', e);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
    process.exit(process.exitCode || 0);
  }
}

migrate();
