const express = require('express');
const { Category, Product, OperationLog } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { success, fail } = require('../utils/helpers');
const CacheUtil = require('../utils/cache');

const router = express.Router();

// GET /api/v1/categories
router.get('/', auth, async (req, res) => {
  try {
    const cacheKey = CacheUtil.keys.categoryList();
    const cached = await CacheUtil.get(cacheKey);
    if (cached) {
      return res.json(success(cached));
    }

    const categories = await Category.findAll({
      where: { status: 1 },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      raw: true,
    });

    await CacheUtil.set(cacheKey, categories, 600);

    res.json(success(categories));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json(fail(500, 'server error'));
  }
});

// POST /api/v1/categories
router.post('/', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const { category_name, parent_id, sort_order } = req.body;
    if (!category_name) {
      return res.status(400).json(fail(400, 'category_name is required'));
    }
    const category = await Category.create({ category_name, parent_id: parent_id || 0, sort_order: sort_order || 0 });
    await OperationLog.create({ user_id: req.userId, operation_type: 'category', operation_detail: `create category: ${category_name}` });

    await CacheUtil.clearCategoryCache();

    res.json(success(category, 'created'));
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json(fail(500, 'server error'));
  }
});

// PUT /api/v1/categories/:id
router.put('/:id', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json(fail(404, 'category not found'));
    }
    const { category_name, parent_id, sort_order, status } = req.body;
    await category.update({ category_name, parent_id, sort_order, status });
    await OperationLog.create({ user_id: req.userId, operation_type: 'category', operation_detail: `update category: ${category.category_name}` });

    await CacheUtil.clearCategoryCache();

    res.json(success(null, 'updated'));
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json(fail(500, 'server error'));
  }
});

// DELETE /api/v1/categories/:id
router.delete('/:id', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json(fail(404, 'category not found'));
    }
    const productCount = await Product.count({ where: { category_id: req.params.id } });
    if (productCount > 0) {
      return res.status(400).json(fail(400, 'category has products'));
    }
    await category.update({ status: 0 });
    await OperationLog.create({ user_id: req.userId, operation_type: 'category', operation_detail: `delete category: ${category.category_name}` });

    await CacheUtil.clearCategoryCache();

    res.json(success(null, 'deleted'));
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json(fail(500, 'server error'));
  }
});

module.exports = router;
