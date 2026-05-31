const express = require('express');
const { Op } = require('sequelize');
const { OperationLog, User } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { getPagination, getPagingData, success, fail } = require('../utils/helpers');

const router = express.Router();

// GET /api/v1/operation-logs
router.get('/', auth, checkPermission('log_query'), async (req, res) => {
  try {
    const { page = 1, page_size = 20, user_id, operation_type, start_date, end_date } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    const where = {};
    if (user_id) where.user_id = user_id;
    if (operation_type) where.operation_type = operation_type;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = start_date;
      if (end_date) where.created_at[Op.lte] = end_date;
    }
    const { count, rows } = await OperationLog.findAndCountAll({
      where, limit, offset,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'real_name'] }],
      order: [['id', 'DESC']],
    });
    res.json(success(getPagingData(count, rows, page, limit)));
  } catch (error) {
    console.error(error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
