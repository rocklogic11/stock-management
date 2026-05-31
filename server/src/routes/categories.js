const express = require('express');
const { Category, Product, OperationLog } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { success, fail } = require('../utils/helpers');
const CacheUtil = require('../utils/cache');

const router = express.Router();

// GET /api/v1/categories
router.get('/', auth, async (req, res) => {
  try {
    // 尝试从缓存获取
    const cacheKey = CacheUtil.keys.categoryList();
    const cached = CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }
    
    const categories = await Category.findAll({
      where: { status: 1 },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    
    // 缓存结果（10分钟）
    CacheUtil.set(cacheKey, categories, 600);
    
    res.json(success(categories));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/categories
router.post('/', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const { category_name, parent_id, sort_order } = req.body;
    if (!category_name) {
      return res.status(400).json(fail(400, '分类名称不能为空'));
    }
    const category = await Category.create({ category_name, parent_id: parent_id || 0, sort_order: sort_order || 0 });
    await OperationLog.create({ user_id: req.userId, operation_type: '分类管理', operation_detail: `新增分类: ${category_name}` });
    
    // 清除分类列表缓存
    CacheUtil.clearCategoryCache();
    
    res.json(success(category, '创建成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/categories/:id
router.put('/:id', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json(fail(404, '分类不存在'));
    }
    const { category_name, parent_id, sort_order, status } = req.body;
    await category.update({ category_name, parent_id, sort_order, status });
    await OperationLog.create({ user_id: req.userId, operation_type: '分类管理', operation_detail: `更新分类: ${category.category_name}` });
    
    // 清除分类列表缓存
    CacheUtil.clearCategoryCache();
    
    res.json(success(null, '更新成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// DELETE /api/v1/categories/:id
router.delete('/:id', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json(fail(404, '分类不存在'));
    }
    const productCount = await Product.count({ where: { category_id: req.params.id } });
    if (productCount > 0) {
      return res.status(400).json(fail(400, '该分类下存在商品，无法删除'));
    }
    await category.update({ status: 0 });
    await OperationLog.create({ user_id: req.userId, operation_type: '分类管理', operation_detail: `删除分类: ${category.category_name}` });
    
    // 清除分类列表缓存
    CacheUtil.clearCategoryCache();
    
    res.json(success(null, '删除成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
