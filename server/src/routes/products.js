const express = require('express');
const { Op } = require('sequelize');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Product, Category, StockAlertSetting, OperationLog } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { getPagination, getPagingData, generateSkuCode, success, fail } = require('../utils/helpers');
const CacheUtil = require('../utils/cache');

const router = express.Router();

// 按角色过滤敏感字段（成本价等）
function filterSensitiveFields(data, user) {
  const isOwner = user && user.role && (user.role.role_name === '店主' || (user.role.permissions && typeof user.role.permissions === 'object' && user.role.permissions.permission_manage));
  if (isOwner) return data;
  // 非店主：移除成本价和金额相关字段
  if (data && data.items && Array.isArray(data.items)) {
    return { ...data, items: data.items.map(item => {
      const { cost_price, ...rest } = item.toJSON ? item.toJSON() : item;
      return rest;
    })};
  }
  return data;
}

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../uploads/qrcodes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// GET /api/v1/products
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, keyword, category_id, status } = req.query;
    
    // 尝试从缓存获取
    const cacheKey = CacheUtil.keys.productList(req.query);
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      // 按角色过滤敏感字段
      const filtered = filterSensitiveFields(cached, req.user);
      return res.json(success(filtered));
    }
    
    const { limit, offset } = getPagination(page, page_size);
    const where = {};
    if (keyword) {
      where[Op.or] = [
        { product_name: { [Op.like]: `%${keyword}%` } },
        { sku_code: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (category_id) where.category_id = category_id;
    if (status !== undefined) where.status = status;
    const { count, rows } = await Product.findAndCountAll({
      where, limit, offset,
      attributes: ['id', 'sku_code', 'product_name', 'category_id', 'cost_price', 'retail_price', 'stock_quantity', 'status', 'image_url', 'created_at'],
      include: [
        { model: Category, as: 'category', attributes: ['id', 'category_name'] },
        { model: StockAlertSetting, as: 'alertSetting', attributes: ['id', 'alert_threshold', 'is_active'] },
      ],
      order: [['id', 'DESC']],
    });
    const result = getPagingData(count, rows, page, limit);
    
    // 缓存结果（5分钟）
    await CacheUtil.set(cacheKey, result, 300);
    
    // 按角色过滤敏感字段
    const filtered = filterSensitiveFields(result, req.user);
    res.json(success(filtered));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/products/:id
router.get('/:id', auth, async (req, res) => {
  try {
    // 尝试从缓存获取
    const cacheKey = CacheUtil.keys.product(req.params.id);
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }
    
    const product = await Product.findByPk(req.params.id, {
      attributes: ['id', 'sku_code', 'product_name', 'category_id', 'cost_price', 'retail_price', 'stock_quantity', 'status', 'image_url', 'qr_code', 'created_at', 'updated_at'],
      include: [
        { model: Category, as: 'category', attributes: ['id', 'category_name'] },
        { model: StockAlertSetting, as: 'alertSetting', attributes: ['id', 'alert_threshold', 'is_active'] },
      ],
    });
    if (!product) {
      return res.status(404).json(fail(404, '商品不存在'));
    }
    
    // 缓存结果（10分钟）
    await CacheUtil.set(cacheKey, product, 600);
    
    // 按角色过滤敏感字段
    const filtered = filterSensitiveFields({ items: [product] }, req.user);
    res.json(success(filtered.items[0]));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/products
router.post('/', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const { product_name, category_id, cost_price, retail_price, stock_quantity, image_url } = req.body;
    if (!product_name || !category_id) {
      return res.status(400).json(fail(400, '商品名称和分类不能为空'));
    }
    const sku_code = generateSkuCode();
    const product = await Product.create({
      sku_code,
      product_name,
      category_id,
      cost_price: cost_price || 0,
      retail_price: retail_price || 0,
      stock_quantity: stock_quantity || 0,
      image_url,
    });
    await OperationLog.create({ user_id: req.userId, operation_type: '商品管理', operation_detail: `新增商品: ${product_name} (${sku_code})` });
    
    // 清除商品列表缓存
    CacheUtil.clearProductCache();
    
    res.json(success(product, '创建成功'));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/products/:id
router.put('/:id', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json(fail(404, '商品不存在'));
    }
    const { product_name, category_id, cost_price, retail_price, image_url, status } = req.body;
    await product.update({ product_name, category_id, cost_price, retail_price, image_url, status });
    await OperationLog.create({ user_id: req.userId, operation_type: '商品管理', operation_detail: `更新商品: ${product.product_name} (${product.sku_code})` });
    
    // 清除缓存：该商品详情 + 商品列表
    CacheUtil.del(CacheUtil.keys.product(req.params.id));
    CacheUtil.clearProductCache();
    
    res.json(success(null, '更新成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// DELETE /api/v1/products/:id
router.delete('/:id', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json(fail(404, '商品不存在'));
    }
    await product.update({ status: 0 });
    await OperationLog.create({ user_id: req.userId, operation_type: '商品管理', operation_detail: `下架商品: ${product.product_name} (${product.sku_code})` });
    
    // 清除缓存：该商品详情 + 商品列表
    CacheUtil.del(CacheUtil.keys.product(req.params.id));
    CacheUtil.clearProductCache();
    
    res.json(success(null, '下架成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/products/:id/qrcode
router.post('/:id/qrcode', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json(fail(404, '商品不存在'));
    }
    const qrData = product.sku_code;
    const fileName = `qrcode_${product.sku_code}.png`;
    const filePath = path.join(uploadDir, fileName);
    await QRCode.toFile(filePath, qrData, { width: 200, margin: 2 });
    const qrCodePath = `/uploads/qrcodes/${fileName}`;
    await product.update({ qr_code: qrCodePath });
    await OperationLog.create({ user_id: req.userId, operation_type: '商品管理', operation_detail: `生成二维码: ${product.product_name} (${product.sku_code})` });
    res.json(success({ qr_code: qrCodePath }, '二维码生成成功'));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '二维码生成失败'));
  }
});

module.exports = router;
