const express = require('express');
const { sequelize, Product, InboundOrder, InboundOrderItem, OperationLog, Notification, User, Role, StockMovement } = require('../models');
const { Op } = require('sequelize');
const { auth, checkPermission } = require('../middleware/auth');
const { getPagination, getPagingData, generateInboundOrderNo, success, fail } = require('../utils/helpers');
const CacheUtil = require('../utils/cache');

const router = express.Router();

// GET /api/v1/inbound-orders
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, status, start_date, end_date } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    const where = {};
    if (status) where.status = status;
    if (start_date || end_date) {
      const { Op } = require('sequelize');
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = start_date;
      if (end_date) where.created_at[Op.lte] = end_date;
    }
    const { count, rows } = await InboundOrder.findAndCountAll({
      where, limit, offset,
      attributes: ['id', 'order_no', 'user_id', 'total_quantity', 'total_amount', 'status', 'remark', 'created_at'],
      include: [
        { model: require('../models/User'), as: 'user', attributes: ['id', 'username', 'real_name'] },
        { model: InboundOrderItem, as: 'items', attributes: ['id', 'product_id', 'quantity', 'unit_price', 'total_price'], include: [{ model: Product, as: 'product', attributes: ['id', 'sku_code', 'product_name'] }] },
      ],
      order: [['id', 'DESC']],
    });
    res.json(success(getPagingData(count, rows, page, limit)));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/inbound-orders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await InboundOrder.findByPk(req.params.id, {
      include: [
        { model: require('../models/User'), as: 'user', attributes: ['id', 'username', 'real_name'] },
        { model: InboundOrderItem, as: 'items', include: [{ model: Product, as: 'product' }] },
      ],
    });
    if (!order) {
      return res.status(404).json(fail(404, '入库单不存在'));
    }
    res.json(success(order));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/inbound-orders
router.post('/', auth, checkPermission('inbound_manage'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { items, remark, status: orderStatus } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json(fail(400, '入库商品列表不能为空'));
    }
    const order_no = generateInboundOrderNo();
    let total_quantity = 0;
    let total_amount = 0;
    const orderItems = [];
    for (const item of items) {
      const { product_id, quantity, unit_price } = item;
      if (!product_id || !quantity || quantity <= 0) {
        await t.rollback();
        return res.status(400).json(fail(400, '商品ID和数量不能为空，数量必须大于0'));
      }
      const product = await Product.findByPk(product_id, { transaction: t });
      if (!product) {
        await t.rollback();
        return res.status(404).json(fail(404, `商品ID ${product_id} 不存在`));
      }
      const price = unit_price || product.cost_price;
      const itemTotal = quantity * price;
      total_quantity += quantity;
      total_amount += itemTotal;
      orderItems.push({ product_id, quantity, unit_price: price, total_price: itemTotal });
    }
    const order = await InboundOrder.create({
      order_no, user_id: req.userId, total_quantity, total_amount, status: orderStatus || 2, remark,
    }, { transaction: t });
    for (const item of orderItems) {
      await InboundOrderItem.create({ order_id: order.id, ...item }, { transaction: t });
    }
    // 如果状态为已完成，更新库存和加权平均成本
    if (order.status === 1) {
      for (const item of orderItems) {
        const product = await Product.findByPk(item.product_id, { transaction: t });
        const newQuantity = product.stock_quantity + item.quantity;
        const newCostPrice = ((product.stock_quantity * product.cost_price) + (item.quantity * item.unit_price)) / newQuantity;
        await product.update({ stock_quantity: newQuantity, cost_price: Math.round(newCostPrice * 100) / 100 }, { transaction: t });
      }
    }
    await OperationLog.create({
      user_id: req.userId, operation_type: '入库管理',
      operation_detail: `创建入库单: ${order_no}, ${total_quantity}件商品`,
    }, { transaction: t });
    await t.commit();
    // 如果直接确认入库，清理库存相关缓存
    if (orderStatus === 1) {
      await CacheUtil.clearProductCache();
      await CacheUtil.clearStockCache();
      await CacheUtil.clearDashboardCache();
    }
    res.json(success({ id: order.id, order_no }, '入库单创建成功'));
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/inbound-orders/:id/confirm
router.put('/:id/confirm', auth, checkPermission('inbound_manage'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const order = await InboundOrder.findByPk(req.params.id, {
      include: [{ model: InboundOrderItem, as: 'items' }],
      transaction: t,
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json(fail(404, '入库单不存在'));
    }
    if (order.status === 1) {
      await t.rollback();
      return res.status(400).json(fail(1005, '入库单已完成，不能重复确认'));
    }
    // 更新库存和加权平均成本
    for (const item of order.items) {
      const product = await Product.findByPk(item.product_id, { transaction: t });
      const beforeQty = product.stock_quantity;
      const newQuantity = product.stock_quantity + item.quantity;
      const newCostPrice = item.unit_price > 0
        ? ((product.stock_quantity * product.cost_price) + (item.quantity * item.unit_price)) / newQuantity
        : product.cost_price;
      await product.update({ stock_quantity: newQuantity, cost_price: Math.round(newCostPrice * 100) / 100 }, { transaction: t });
      // 记录库存流水
      await StockMovement.create({
        product_id: product.id,
        movement_type: 'inbound',
        quantity: item.quantity,
        before_quantity: beforeQty,
        after_quantity: newQuantity,
        unit_cost: item.unit_price,
        reference_type: 'inbound_order',
        reference_id: order.id,
        operator_id: req.userId,
      }, { transaction: t });
      // 检查库存预警
      const alertSetting = await require('../models/StockAlertSetting').findOne({
        where: { product_id: product.id, is_active: 1 }, transaction: t,
      });
      if (alertSetting && product.stock_quantity < alertSetting.alert_threshold) {
        // 找出所有店主，发送预警通知
        const owners = await User.findAll({
          where: { status: 1 },
          include: [{ model: Role, as: 'role', where: { role_name: '店主' } }],
          transaction: t,
        });
        for (const owner of owners) {
          await Notification.create({
            user_id: owner.id,
            type: 1,
            title: '库存预警提醒',
            content: `${product.product_name}当前库存${product.stock_quantity}件，低于预警阈值${alertSetting.alert_threshold}件`,
            related_id: product.id,
            related_type: '商品',
          }, { transaction: t });
        }
      }
    }
    await order.update({ status: 1 }, { transaction: t });
    await OperationLog.create({
      user_id: req.userId, operation_type: '入库管理',
      operation_detail: `确认入库单: ${order.order_no}`,
    }, { transaction: t });
    await t.commit();
    // 库存变动后清理相关缓存
    await CacheUtil.clearProductCache();
    await CacheUtil.clearStockCache();
    await CacheUtil.clearDashboardCache();
    res.json(success(null, '入库确认成功'));
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// DELETE /api/v1/inbound-orders/:id
router.delete('/:id', auth, checkPermission('inbound_manage'), async (req, res) => {
  try {
    const order = await InboundOrder.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json(fail(404, '入库单不存在'));
    }
    if (order.status === 1) {
      return res.status(400).json(fail(1005, '已完成的入库单不能删除'));
    }
    await InboundOrderItem.destroy({ where: { order_id: order.id } });
    await order.destroy();
    await OperationLog.create({ user_id: req.userId, operation_type: '入库管理', operation_detail: `删除入库单: ${order.order_no}` });
    res.json(success(null, '删除成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/inbound-orders/:id/scan - 扫码入库
router.post('/:id/scan', auth, checkPermission('inbound_manage'), async (req, res) => {
  try {
    let { sku_code, quantity } = req.body;
    if (!sku_code) return res.status(400).json(fail(400, 'sku_code不能为空'));
    quantity = quantity || 1;
    // 兼容JSON格式的二维码内容
    try {
      const parsed = JSON.parse(sku_code);
      sku_code = parsed.sku_code || sku_code;
    } catch (e) {}
    const product = await Product.findOne({ where: { sku_code, status: 1 } });
    if (!product) return res.status(404).json(fail(1001, '商品不存在'));
    const order = await InboundOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json(fail(404, '入库单不存在'));
    if (order.status === 1) return res.status(400).json(fail(1005, '已完成的入库单不能继续扫码'));
    // 查找是否已有该商品明细，有则累加数量
    let orderItem = await InboundOrderItem.findOne({
      where: { order_id: order.id, product_id: product.id },
    });
    if (orderItem) {
      const newQty = orderItem.quantity + quantity;
      const newTotal = newQty * orderItem.unit_price;
      await orderItem.update({ quantity: newQty, total_price: newTotal });
    } else {
      orderItem = await InboundOrderItem.create({
        order_id: order.id,
        product_id: product.id,
        quantity,
        unit_price: product.cost_price,
        total_price: quantity * product.cost_price,
      });
    }
    // 重新计算入库单总数量和总金额
    const allItems = await InboundOrderItem.findAll({ where: { order_id: order.id } });
    const totalQuantity = allItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalAmount = allItems.reduce((sum, i) => sum + i.total_price, 0);
    await order.update({ total_quantity: totalQuantity, total_amount: totalAmount });
    const result = await InboundOrderItem.findByPk(orderItem.id, {
      include: [{ model: Product, as: 'product', attributes: ['id', 'sku_code', 'product_name'] }],
    });
    res.json(success({
      product_id: product.id,
      sku_code: product.sku_code,
      product_name: product.product_name,
      quantity: result.quantity,
      unit_price: result.unit_price,
      total_price: result.total_price,
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/inbound-orders/:id/undo-scan - 撤销上一次扫码
router.post('/:id/undo-scan', auth, checkPermission('inbound_manage'), async (req, res) => {
  try {
    const order = await InboundOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json(fail(404, '入库单不存在'));
    if (order.status === 1) return res.status(400).json(fail(1005, '已完成的入库单不能撤销'));
    const { sku_code } = req.body;
    if (!sku_code) return res.status(400).json(fail(400, 'sku_code不能为空'));
    const product = await Product.findOne({ where: { sku_code } });
    if (!product) return res.status(404).json(fail(1001, '商品不存在'));
    let orderItem = await InboundOrderItem.findOne({
      where: { order_id: order.id, product_id: product.id },
    });
    if (!orderItem) return res.status(404).json(fail(404, '该商品不在入库明细中'));
    if (orderItem.quantity > 1) {
      const newQty = orderItem.quantity - 1;
      await orderItem.update({ quantity: newQty, total_price: newQty * orderItem.unit_price });
    } else {
      await orderItem.destroy();
    }
    // 重新计算总数量和总金额
    const allItems = await InboundOrderItem.findAll({ where: { order_id: order.id } });
    const totalQuantity = allItems.reduce((sum, i) => sum + i.quantity, 0);
    const totalAmount = allItems.reduce((sum, i) => sum + i.total_price, 0);
    await order.update({ total_quantity: totalQuantity, total_amount: totalAmount });
    res.json(success(null, '撤销成功'));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
