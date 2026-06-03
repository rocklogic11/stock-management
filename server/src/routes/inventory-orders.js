const express = require('express');
const { sequelize, Product, InventoryOrder, InventoryOrderItem, OperationLog, Notification, User, Role, StockMovement } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { getPagination, getPagingData, generateInventoryOrderNo, success, fail } = require('../utils/helpers');
const CacheUtil = require('../utils/cache');
const { canViewCost, removeKeys, toPlain } = require('../utils/permissions');

const router = express.Router();

function filterInventoryOrder(order, user) {
  const plain = toPlain(order);
  if (canViewCost(user)) return plain;

  if (Array.isArray(plain.items)) {
    plain.items = plain.items.map(item => {
      removeKeys(item, ['difference_amount']);
      if (item.product) removeKeys(item.product, ['cost_price']);
      return item;
    });
  }
  return plain;
}

// GET /api/v1/inventory-orders
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, status, inventory_type } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    const where = {};
    if (status) where.status = status;
    if (inventory_type) where.inventory_type = inventory_type;
    const { count, rows } = await InventoryOrder.findAndCountAll({
      where, limit, offset,
      attributes: ['id', 'order_no', 'user_id', 'audit_user_id', 'inventory_type', 'inventory_scope', 'total_quantity', 'status', 'audit_status', 'created_at', 'audited_at'],
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'real_name'] },
        { model: User, as: 'auditUser', attributes: ['id', 'username', 'real_name'] },
      ],
      order: [['id', 'DESC']],
    });
    res.json(success(getPagingData(count, rows, page, limit)));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/inventory-orders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await InventoryOrder.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'real_name'] },
        { model: User, as: 'auditUser', attributes: ['id', 'username', 'real_name'] },
        { model: InventoryOrderItem, as: 'items', include: [{ model: Product, as: 'product', attributes: ['id', 'sku_code', 'product_name', 'cost_price'] }] },
      ],
    });
    if (!order) {
      return res.status(404).json(fail(404, '盘点单不存在'));
    }
    res.json(success(filterInventoryOrder(order, req.user)));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/inventory-orders
router.post('/', auth, checkPermission('inventory_manage'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { inventory_type, inventory_scope, items, remark } = req.body;
    const order_no = generateInventoryOrderNo();
    let productList = items || [];
    // 如果没传items，根据inventory_scope选择商品
    if (productList.length === 0) {
      const productWhere = { status: 1 };
      if (inventory_scope) {
        const { Op } = require('sequelize');
        const categoryIds = inventory_scope.split(',').map(Number);
        productWhere.category_id = { [Op.in]: categoryIds };
      }
      const products = await Product.findAll({ where: productWhere, transaction: t });
      productList = products.map(p => ({ product_id: p.id }));
    }
    if (productList.length === 0) {
      await t.rollback();
      return res.status(400).json(fail(400, '没有可盘点的商品'));
    }
    const order = await InventoryOrder.create({
      order_no, user_id: req.userId,
      inventory_type: inventory_type || 1,
      inventory_scope,
      total_quantity: productList.length,
      status: 1,
      remark,
    }, { transaction: t });
    for (const item of productList) {
      const product = await Product.findByPk(item.product_id, { transaction: t });
      if (!product) continue;
      await InventoryOrderItem.create({
        order_id: order.id,
        product_id: product.id,
        system_quantity: product.stock_quantity,
        actual_quantity: item.actual_quantity || null,
        difference: item.actual_quantity !== undefined ? item.actual_quantity - product.stock_quantity : null,
        difference_amount: item.actual_quantity !== undefined ? (item.actual_quantity - product.stock_quantity) * product.cost_price : null,
        status: item.actual_quantity !== undefined ? 2 : 1,
      }, { transaction: t });
    }
    await OperationLog.create({
      user_id: req.userId, operation_type: '盘点管理',
      operation_detail: `创建盘点单: ${order_no}`,
    }, { transaction: t });
    await t.commit();
    res.json(success({ id: order.id, order_no }, '盘点单创建成功'));
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/inventory-orders/:id/scan - 扫码盘点
router.post('/:id/scan', auth, checkPermission('inventory_manage'), async (req, res) => {
  try {
    let { sku_code } = req.body;
    if (!sku_code) return res.status(400).json(fail(400, 'sku_code不能为空'));
    // 兼容JSON格式的二维码内容（旧版二维码可能包含JSON）
    try {
      const parsed = JSON.parse(sku_code);
      sku_code = parsed.sku_code || sku_code;
    } catch (e) {
      // 不是JSON，直接作为SKU使用
    }
    // 优先按系统 SKU 查找，其次按商品包装条码/二维码编号查找
    let product = await Product.findOne({ where: { sku_code, status: 1 } });
    if (!product) {
      product = await Product.findOne({ where: { barcode: sku_code, status: 1 } });
    }
    if (!product) return res.status(404).json(fail(1001, '商品不存在'));
    // 找到盘点单明细
    let orderItem = await InventoryOrderItem.findOne({
      where: { order_id: req.params.id, product_id: product.id },
    });
    if (!orderItem) {
      // 如果盘点单不含此商品，自动创建明细
      const order = await InventoryOrder.findByPk(req.params.id);
      if (!order) return res.status(404).json(fail(1004, '盘点单不存在'));
      orderItem = await InventoryOrderItem.create({
        order_id: order.id,
        product_id: product.id,
        system_quantity: product.stock_quantity,
        actual_quantity: 1,
        difference: 1 - product.stock_quantity,
        difference_amount: (1 - product.stock_quantity) * product.cost_price,
        status: 2,
      });
    } else {
      const newQty = (orderItem.actual_quantity || 0) + 1;
      await orderItem.update({
        actual_quantity: newQty,
        difference: newQty - orderItem.system_quantity,
        difference_amount: (newQty - orderItem.system_quantity) * (orderItem.product ? orderItem.product.cost_price : 0),
        status: 2,
      });
    }
    // 重新加载带关联的明细
    const result = await InventoryOrderItem.findByPk(orderItem.id, {
      include: [{ model: Product, as: 'product' }],
    });
    res.json(success({
      product_id: result.product_id,
      product_name: result.product ? result.product.product_name : '',
      system_quantity: result.system_quantity,
      scanned_quantity: result.actual_quantity,
      difference: result.difference,
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/inventory-orders/:id/item
router.put('/:id/item', auth, checkPermission('inventory_manage'), async (req, res) => {
  try {
    const { product_id, actual_quantity } = req.body;
    const orderItem = await InventoryOrderItem.findOne({
      where: { order_id: req.params.id, product_id },
      include: [{ model: Product, as: 'product' }],
    });
    if (!orderItem) {
      return res.status(404).json(fail(404, '盘点明细不存在'));
    }
    const difference = actual_quantity - orderItem.system_quantity;
    const difference_amount = difference * (orderItem.product ? orderItem.product.cost_price : 0);
    await orderItem.update({ actual_quantity, difference, difference_amount, status: 2 });
    res.json(success(null, '盘点记录更新成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/inventory-orders/:id/submit
router.put('/:id/submit', auth, checkPermission('inventory_manage'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const order = await InventoryOrder.findByPk(req.params.id, {
      include: [{ model: InventoryOrderItem, as: 'items' }],
      transaction: t,
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json(fail(404, '盘点单不存在'));
    }
    if (order.status !== 1) {
      await t.rollback();
      return res.status(400).json(fail(1005, '盘点单状态不允许提交'));
    }
    // 检查是否所有商品已盘点
    const unChecked = order.items.filter(item => item.status === 1);
    if (unChecked.length > 0) {
      await t.rollback();
      return res.status(400).json(fail(400, `还有${unChecked.length}件商品未盘点`));
    }
    await order.update({ status: 2 }, { transaction: t });
    // 通知店主审核
    const owners = await User.findAll({
      where: { status: 1 },
      include: [{ model: Role, as: 'role', where: { role_name: '店主' } }],
      transaction: t,
    });
    for (const owner of owners) {
      await Notification.create({
        user_id: owner.id, type: 2,
        title: '盘点审核通知',
        content: `盘点单${order.order_no}已提交，请审核`,
        related_id: order.id, related_type: '盘点单',
      }, { transaction: t });
    }
    await OperationLog.create({
      user_id: req.userId, operation_type: '盘点管理',
      operation_detail: `提交盘点单: ${order.order_no}`,
    }, { transaction: t });
    await t.commit();
    res.json(success(null, '盘点单提交成功'));
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/inventory-orders/:id/audit
router.put('/:id/audit', auth, checkPermission('inventory_audit'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const auditStatus = Number(req.body.audit_status);
    const { audit_opinion } = req.body;
    if (!auditStatus) {
      await t.rollback();
      return res.status(400).json(fail(400, '审核状态不能为空'));
    }
    const order = await InventoryOrder.findByPk(req.params.id, {
      include: [{ model: InventoryOrderItem, as: 'items', include: [{ model: Product, as: 'product' }] }],
      transaction: t,
    });
    if (!order) {
      await t.rollback();
      return res.status(404).json(fail(404, '盘点单不存在'));
    }
    if (order.status !== 2) {
      await t.rollback();
      return res.status(400).json(fail(1005, '盘点单状态不允许审核'));
    }

    const lockedProducts = new Map();
    if (auditStatus === 1) {
      for (const item of order.items) {
        const product = await Product.findByPk(item.product_id, {
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (product) lockedProducts.set(Number(product.id), product);
      }

      const conflicts = order.items
        .filter(item => {
          const product = lockedProducts.get(Number(item.product_id));
          return !product || Number(product.stock_quantity) !== Number(item.system_quantity);
        })
        .map(item => {
          const product = lockedProducts.get(Number(item.product_id)) || item.product;
          return {
            product_id: item.product_id,
            product_name: product ? product.product_name : '',
            sku_code: product ? product.sku_code : '',
            snapshot_quantity: item.system_quantity,
            current_quantity: product ? product.stock_quantity : null,
            actual_quantity: item.actual_quantity,
          };
        });

      if (conflicts.length > 0) {
        await t.rollback();
        return res.status(409).json(fail(1006, '盘点期间库存已发生变化，请重新盘点或核对后再审核', { conflicts }));
      }

      for (const item of order.items) {
        const product = lockedProducts.get(Number(item.product_id));
        if (item.difference !== 0 && product) {
          const beforeQty = item.system_quantity;
          const afterQty = item.actual_quantity;
          await product.update({ stock_quantity: afterQty }, { transaction: t });
          // 记录库存流水
          await StockMovement.create({
            product_id: product.id,
            movement_type: 'inventory_adjust',
            quantity: item.difference,
            before_quantity: beforeQty,
            after_quantity: afterQty,
            unit_cost: product.cost_price,
            reference_type: 'inventory_order',
            reference_id: order.id,
            operator_id: req.userId,
          }, { transaction: t });
        }
      }
    }

    await order.update({
      status: 3, audit_status: auditStatus, audit_opinion, audit_user_id: req.userId, audited_at: new Date(),
    }, { transaction: t });

    // 通知店员审核结果
    await Notification.create({
      user_id: order.user_id, type: 3,
      title: '盘点审核结果',
      content: `盘点单${order.order_no}${auditStatus === 1 ? '已通过' : '已驳回'}${audit_opinion ? '，' + audit_opinion : ''}`,
      related_id: order.id, related_type: '盘点单',
    }, { transaction: t });
    await OperationLog.create({
      user_id: req.userId, operation_type: '盘点审核',
      operation_detail: `审核盘点单: ${order.order_no}, ${auditStatus === 1 ? '通过' : '驳回'}`,
    }, { transaction: t });
    await t.commit();
    // 盘点审核通过后库存已变更，清理缓存
    await CacheUtil.clearProductCache();
    await CacheUtil.clearStockCache();
    await CacheUtil.clearDashboardCache();
    res.json(success(null, auditStatus === 1 ? '审核通过' : '已驳回'));
  } catch (error) {
    await t.rollback();
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// DELETE /api/v1/inventory-orders/:id - 删除盘点单
router.delete('/:id', auth, checkPermission('inventory_manage'), async (req, res) => {
  try {
    const order = await InventoryOrder.findByPk(req.params.id);
    if (!order) return res.status(404).json(fail(404, '盘点单不存在'));
    if (order.status !== 1) return res.status(400).json(fail(1005, '只能删除待盘点状态的单据'));
    await InventoryOrderItem.destroy({ where: { order_id: order.id } });
    await order.destroy();
    await OperationLog.create({ user_id: req.userId, operation_type: '盘点管理', operation_detail: `删除盘点单: ${order.order_no}` });
    res.json(success(null, '删除成功'));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
