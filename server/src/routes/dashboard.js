const express = require('express');
const { sequelize, Product, StockAlertSetting, InboundOrder, InboundOrderItem, InventoryOrder, OperationLog, User } = require('../models');
const { auth } = require('../middleware/auth');
const { success, fail } = require('../utils/helpers');
const CacheUtil = require('../utils/cache');

const router = express.Router();

// GET /api/v1/dashboard
router.get('/', auth, async (req, res) => {
  try {
    // 尝试从缓存获取（缓存1分钟）
    const cacheKey = CacheUtil.keys.dashboardStats();
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }
    
    const user = req.user;
    const permissions = typeof user.role.permissions === 'string' ? JSON.parse(user.role.permissions) : user.role.permissions;
    const isOwner = permissions.permission_manage === true;

    // 库存总值（成本价）
    const costResult = await Product.findOne({
      where: { status: 1 },
      attributes: [[sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.literal('stock_quantity * cost_price')), 0), 'total_cost_value']],
      raw: true,
    });
    // 库存总值（零售价）
    const retailResult = await Product.findOne({
      where: { status: 1 },
      attributes: [[sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.literal('stock_quantity * retail_price')), 0), 'total_retail_value']],
      raw: true,
    });
    // 商品种类数
    const product_count = await Product.count({ where: { status: 1 } });
    // 库存预警数（优化：使用JOIN代替循环查询）
    const alert_count = await StockAlertSetting.count({
      where: { is_active: 1 },
      include: [{
        model: Product,
        as: 'product',
        where: sequelize.literal('stock_quantity < alert_threshold'),
        attributes: []
      }]
    });
    // 今日入库量
    const { Op } = require('sequelize');
    const today = new Date().toISOString().slice(0, 10);
    const todayInbound = await InboundOrderItem.findAll({
      where: { '$order.created_at$': { [Op.gte]: today } },
      include: [{ model: InboundOrder, as: 'order', attributes: [] }],
      attributes: [[sequelize.fn('COALESCE', sequelize.fn('SUM', sequelize.col('quantity')), 0), 'total']],
      raw: true,
    });
    const today_inbound_quantity = parseInt(todayInbound[0]?.total || 0);
    // 待审核盘点单
    const pending_audit_count = await InventoryOrder.count({ where: { status: 2 } });
    // 最近操作记录
    const recent_operations = await OperationLog.findAll({
      limit: 5,
      attributes: ['id', 'operation_type', 'operation_detail', 'created_at', 'user_id'],
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'real_name'] }],
      order: [['id', 'DESC']],
    });

    const result = isOwner ? {
      total_cost_value: parseFloat(costResult.total_cost_value || 0),
      total_retail_value: parseFloat(retailResult.total_retail_value || 0),
      product_count,
      alert_count,
      today_inbound_quantity,
      pending_audit_count,
      recent_operations: recent_operations.map(op => ({
        id: op.id,
        operation_type: op.operation_type,
        operation_detail: op.operation_detail,
        operator: op.user ? op.user.real_name || op.user.username : '未知',
        created_at: op.created_at,
      })),
      // 分类库存结构
      category_stock: await getCategoryStock(),
      // 库存健康排行（低库存Top5）
      health_ranking: await getHealthRanking(),
      // 待办风险
      pending_tasks: await getPendingTasks(alert_count, pending_audit_count),
    } : {
      total_cost_value: 0,
      total_retail_value: 0,
      product_count,
      alert_count,
      today_inbound_quantity,
      pending_audit_count: 0,
      recent_operations: [],
      category_stock: await getCategoryStock(),
      health_ranking: [],
      pending_tasks: [],
    };
    
    // 缓存结果（1分钟）
    await CacheUtil.set(cacheKey, result, 60);
    
    res.json(success(result));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;

// 分类库存结构
async function getCategoryStock() {
  const { Category } = require('../models');
  const categories = await Category.findAll({ attributes: ['id', 'category_name'] });
  const result = [];
  for (const cat of categories) {
    const products = await Product.findAll({ where: { category_id: cat.id, status: 1 }, attributes: ['stock_quantity', 'cost_price'] });
    const totalQty = products.reduce((s, p) => s + p.stock_quantity, 0);
    const totalValue = products.reduce((s, p) => s + p.stock_quantity * parseFloat(p.cost_price || 0), 0);
    if (totalQty > 0) {
      result.push({ category_name: cat.category_name, quantity: totalQty, value: Math.round(totalValue * 100) / 100 });
    }
  }
  return result;
}

// 库存健康排行
async function getHealthRanking() {
  const alertSettings = await StockAlertSetting.findAll({ where: { is_active: 1 } });
  const items = [];
  for (const setting of alertSettings) {
    const product = await Product.findOne({ where: { id: setting.product_id, status: 1 } });
    if (product && product.stock_quantity < setting.alert_threshold) {
      items.push({
        product_name: product.product_name,
        sku_code: product.sku_code,
        current_stock: product.stock_quantity,
        alert_threshold: setting.alert_threshold,
        health_percent: Math.round(product.stock_quantity / setting.alert_threshold * 100),
      });
    }
  }
  return items.sort((a, b) => a.health_percent - b.health_percent).slice(0, 5);
}

// 待办风险
async function getPendingTasks(alertCount, pendingAuditCount) {
  const tasks = [];
  if (alertCount > 0) {
    tasks.push({ type: 'alert', title: `${alertCount} 款商品低库存`, desc: '建议尽快补货' });
  }
  if (pendingAuditCount > 0) {
    tasks.push({ type: 'audit', title: `${pendingAuditCount} 张盘点单待审核`, desc: '请店主确认盘点差异' });
  }
  // 检查未打印二维码的商品
  const unprintedCount = await Product.count({ where: { status: 1, qr_code: null } });
  if (unprintedCount > 0) {
    tasks.push({ type: 'qrcode', title: `${unprintedCount} 款商品二维码未打印`, desc: '建议在上架前批量打印' });
  }
  return tasks;
}
