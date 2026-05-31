const express = require('express');
const { InboundOrder, InboundOrderItem, Product, StockAlertSetting, Category } = require('../models');
const { Op } = require('sequelize');
const { auth } = require('../middleware/auth');
const { getPagination, getPagingData, success, fail } = require('../utils/helpers');

const router = express.Router();

// GET /api/v1/analytics/stock-alerts - 库存预警列表
router.get('/stock-alerts', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    const alertSettings = await StockAlertSetting.findAll({ where: { is_active: 1 } });
    const alertProducts = [];
    for (const setting of alertSettings) {
      const product = await Product.findOne({
        where: { id: setting.product_id, status: 1 },
        include: [{ model: Category, as: 'category', attributes: ['id', 'category_name'] }],
      });
      if (product && product.stock_quantity < setting.alert_threshold) {
        const item = {
          product_id: product.id,
          sku_code: product.sku_code,
          product_name: product.product_name,
          category_name: product.category ? product.category.category_name : '',
          current_stock: product.stock_quantity,
          alert_threshold: setting.alert_threshold,
          retail_price: product.retail_price,
        };
        // 只有店主可见成本价
        const isOwner = req.user && req.user.role && (req.user.role.role_name === '店主' || (req.user.role.permissions && typeof req.user.role.permissions === 'object' && req.user.role.permissions.permission_manage));
        if (isOwner) {
          item.cost_price = product.cost_price;
        }
        alertProducts.push(item);
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

// GET /api/v1/analytics/purchase-suggestions - 低库存补货建议
router.get('/purchase-suggestions', auth, async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { status: 1 },
      include: [{ model: StockAlertSetting, as: 'alertSetting', where: { is_active: 1 }, required: false }],
    });
    const suggestions = [];
    for (const product of products) {
      const threshold = product.alertSetting ? product.alertSetting.alert_threshold : 0;
      if (threshold <= 0) continue; // 未设置预警阈值的商品跳过
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const inboundItems = await InboundOrderItem.findAll({
        where: { product_id: product.id },
        include: [{ model: InboundOrder, as: 'order', where: { created_at: { [Op.gte]: thirtyDaysAgo }, status: 1 } }],
      });
      let totalInbound = 0;
      for (const item of inboundItems) totalInbound += item.quantity;
      const dailyInbound = totalInbound > 0 ? totalInbound / 30 : 0;
      const daysOfSupply = dailyInbound > 0 ? Math.floor(product.stock_quantity / dailyInbound) : 999;
      const suggestedQuantity = product.stock_quantity <= threshold
        ? Math.max(threshold - product.stock_quantity, Math.ceil(dailyInbound * 7))
        : (daysOfSupply < 7 ? Math.ceil(dailyInbound * 7) : 0);
      if (product.stock_quantity <= threshold || daysOfSupply < 7) {
        suggestions.push({
          product_id: product.id,
          sku_code: product.sku_code,
          product_name: product.product_name,
          current_stock: product.stock_quantity,
          daily_inbound: Math.round(dailyInbound * 100) / 100,
          days_of_supply: daysOfSupply,
          suggested_quantity: suggestedQuantity,
          alert_threshold: threshold,
        });
      }
    }
    res.json(success({ total: suggestions.length, items: suggestions }));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
