const express = require('express');
const { Op } = require('sequelize');
const { Product, StockAlertSetting, Category, OperationLog } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { getPagination, getPagingData, success, fail } = require('../utils/helpers');

const router = express.Router();

// GET /api/v1/stock-alerts - 获取预警商品列表
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    // 查询所有启用预警的商品
    const alertSettings = await StockAlertSetting.findAll({ where: { is_active: 1 } });
    const productIds = alertSettings.map(s => s.product_id);
    if (productIds.length === 0) {
      return res.json(success(getPagingData(0, [], page, limit)));
    }
    // 查询库存低于阈值的商品
    const alertProducts = [];
    for (const setting of alertSettings) {
      const product = await Product.findOne({
        where: { id: setting.product_id, status: 1 },
        include: [{ model: Category, as: 'category', attributes: ['id', 'category_name'] }],
      });
      if (product && product.stock_quantity < setting.alert_threshold) {
        alertProducts.push({
          ...product.toJSON(),
          alert_threshold: setting.alert_threshold,
          alert_id: setting.id,
        });
      }
    }
    const total = alertProducts.length;
    const paged = alertProducts.slice(offset, offset + limit);
    res.json(success(getPagingData(total, paged, page, limit)));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/stock-alerts/settings - 获取预警设置列表
router.get('/settings', auth, checkPermission('alert_manage'), async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    const { count, rows } = await StockAlertSetting.findAndCountAll({
      where: {},
      include: [{ model: Product, as: 'product', attributes: ['id', 'sku_code', 'product_name', 'stock_quantity'] }],
      limit, offset,
      order: [['id', 'DESC']],
    });
    res.json(success(getPagingData(count, rows, page, limit)));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/stock-alerts/settings - 创建预警设置
router.post('/settings', auth, checkPermission('alert_manage'), async (req, res) => {
  try {
    const { product_id, alert_threshold } = req.body;
    if (!product_id || alert_threshold === undefined) {
      return res.status(400).json(fail(400, '商品ID和预警阈值不能为空'));
    }
    const existing = await StockAlertSetting.findOne({ where: { product_id } });
    if (existing) {
      await existing.update({ alert_threshold, is_active: 1 });
      await OperationLog.create({ user_id: req.userId, operation_type: '预警管理', operation_detail: `更新预警设置: 商品ID ${product_id}, 阈值${alert_threshold}` });
      return res.json(success(existing, '更新成功'));
    }
    const setting = await StockAlertSetting.create({ product_id, alert_threshold, is_active: 1 });
    await OperationLog.create({ user_id: req.userId, operation_type: '预警管理', operation_detail: `创建预警设置: 商品ID ${product_id}, 阈值${alert_threshold}` });
    res.json(success(setting, '创建成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/stock-alerts/settings/:id
router.put('/settings/:id', auth, checkPermission('alert_manage'), async (req, res) => {
  try {
    const setting = await StockAlertSetting.findByPk(req.params.id);
    if (!setting) {
      return res.status(404).json(fail(404, '预警设置不存在'));
    }
    const { alert_threshold, is_active } = req.body;
    await setting.update({ alert_threshold, is_active });
    await OperationLog.create({ user_id: req.userId, operation_type: '预警管理', operation_detail: `更新预警设置: ID ${setting.id}` });
    res.json(success(null, '更新成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// DELETE /api/v1/stock-alerts/settings/:id
router.delete('/settings/:id', auth, checkPermission('alert_manage'), async (req, res) => {
  try {
    const setting = await StockAlertSetting.findByPk(req.params.id);
    if (!setting) {
      return res.status(404).json(fail(404, '预警设置不存在'));
    }
    await setting.update({ is_active: 0 });
    await OperationLog.create({ user_id: req.userId, operation_type: '预警管理', operation_detail: `禁用预警设置: ID ${setting.id}` });
    res.json(success(null, '禁用成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
