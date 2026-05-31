const express = require('express');
const { Op } = require('sequelize');
const { Product, Category, InboundOrderItem, InventoryOrderItem, OperationLog } = require('../models');
const { auth } = require('../middleware/auth');
const { getPagination, getPagingData, success, fail } = require('../utils/helpers');
const CacheUtil = require('../utils/cache');

const router = express.Router();

// GET /api/v1/stock - 实时库存列表
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, keyword, category_id, stock_status } = req.query;
    
    // 尝试从缓存获取
    const cacheKey = CacheUtil.keys.productList({ ...req.query, type: 'stock' });
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }
    
    const { limit, offset } = getPagination(page, page_size);
    const where = { status: 1 };
    if (keyword) {
      where[Op.or] = [
        { product_name: { [Op.like]: `%${keyword}%` } },
        { sku_code: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (category_id) where.category_id = category_id;

    const include = [{ model: Category, as: 'category', attributes: ['id', 'category_name'] }];

    // 库存状态筛选（优化：使用JOIN查询）
    if (stock_status === 'low') {
      include.push({
        model: require('../models/StockAlertSetting'),
        as: 'alertSetting',
        where: { is_active: 1 },
        required: true
      });
      // 需要在查询结果中过滤 stock_quantity < alert_threshold
    }

    const { count, rows } = await Product.findAndCountAll({
      where, limit, offset,
      attributes: ['id', 'sku_code', 'product_name', 'category_id', 'cost_price', 'retail_price', 'stock_quantity', 'status', 'image_url'],
      include,
      order: [['id', 'DESC']],
    });

    // 计算库存金额
    const items = rows.map(p => ({
      id: p.id,
      sku_code: p.sku_code,
      product_name: p.product_name,
      category_id: p.category_id,
      cost_price: p.cost_price,
      retail_price: p.retail_price,
      stock_quantity: p.stock_quantity,
      status: p.status,
      image_url: p.image_url,
      category: p.category,
      cost_total: Math.round(p.stock_quantity * p.cost_price * 100) / 100,
      retail_total: Math.round(p.stock_quantity * p.retail_price * 100) / 100,
    }));

    const result = getPagingData(count, items, page, limit);
    
    // 缓存结果（2分钟）
    await CacheUtil.set(cacheKey, result, 120);
    
    res.json(success(result));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/stock/value-statistics - 库存价值统计
router.get('/value-statistics', auth, async (req, res) => {
  try {
    // 尝试从缓存获取（缓存5分钟）
    const cacheKey = 'stock:value_statistics';
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }
    
    // 使用聚合查询代替循环
    const products = await Product.findAll({
      where: { status: 1 },
      attributes: ['id', 'category_id', 'stock_quantity', 'cost_price', 'retail_price'],
    });
    
    let total_cost_value = 0;
    let total_retail_value = 0;
    const byCategory = {};
    for (const p of products) {
      total_cost_value += p.stock_quantity * p.cost_price;
      total_retail_value += p.stock_quantity * p.retail_price;
      if (!byCategory[p.category_id]) byCategory[p.category_id] = { cost: 0, retail: 0 };
      byCategory[p.category_id].cost += p.stock_quantity * p.cost_price;
      byCategory[p.category_id].retail += p.stock_quantity * p.retail_price;
    }
    
    const result = {
      total_cost_value: Math.round(total_cost_value * 100) / 100,
      total_retail_value: Math.round(total_retail_value * 100) / 100,
      product_count: products.length,
      by_category: byCategory,
    };
    
    // 缓存结果
    await CacheUtil.set(cacheKey, result, 300);
    
    res.json(success(result));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/stock/:product_id - 库存详情
router.get('/:product_id', auth, async (req, res) => {
  try {
    // 尝试从缓存获取
    const cacheKey = CacheUtil.keys.product(req.params.product_id);
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }
    
    const product = await Product.findByPk(req.params.product_id, {
      attributes: ['id', 'sku_code', 'product_name', 'category_id', 'cost_price', 'retail_price', 'stock_quantity', 'status', 'image_url', 'created_at'],
      include: [{ model: Category, as: 'category', attributes: ['id', 'category_name'] }],
    });
    if (!product) return res.status(404).json(fail(404, '商品不存在'));
    
    // 缓存结果（5分钟）
    await CacheUtil.set(cacheKey, product, 300);
    
    res.json(success(product));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/stock/:product_id/history - 库存变动记录
router.get('/:product_id/history', auth, async (req, res) => {
  try {
    const { InboundOrder, InboundOrderItem, InventoryOrder, InventoryOrderItem } = require('../models');
    const productId = req.params.product_id;
    
    // 尝试从缓存获取（缓存1分钟）
    const cacheKey = `stock:history:${productId}`;
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }
    
    // 查询入库记录
    const inboundItems = await InboundOrderItem.findAll({
      where: { product_id: productId },
      attributes: ['id', 'quantity', 'created_at', 'order_id'],
      include: [{ model: InboundOrder, as: 'order', attributes: ['id', 'order_no', 'created_at'] }],
      order: [['id', 'DESC']],
    });
    const inboundHistory = inboundItems.map(item => ({
      type: '入库',
      quantity: item.quantity,
      related_no: item.order ? item.order.order_no : '',
      created_at: item.order ? item.order.created_at : item.created_at,
    }));

    // 查询盘点记录
    const inventoryItems = await InventoryOrderItem.findAll({
      where: { product_id: productId, status: 2 },
      attributes: ['id', 'actual_quantity', 'difference', 'created_at', 'order_id'],
      include: [{ model: InventoryOrder, as: 'order', attributes: ['id', 'order_no', 'created_at'] }],
      order: [['id', 'DESC']],
    });
    const inventoryHistory = inventoryItems.map(item => ({
      type: '盘点',
      quantity: item.actual_quantity,
      difference: item.difference,
      related_no: item.order ? item.order.order_no : '',
      created_at: item.order ? item.order.created_at : item.created_at,
    }));

    const history = [...inboundHistory, ...inventoryHistory].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // 缓存结果（1分钟）
    await CacheUtil.set(cacheKey, history, 60);
    
    res.json(success(history));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
