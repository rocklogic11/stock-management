const express = require('express');
const { Notification } = require('../models');
const { auth } = require('../middleware/auth');
const { getPagination, getPagingData, success, fail } = require('../utils/helpers');

const router = express.Router();

// GET /api/v1/notifications
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, page_size = 20, type, is_read } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    const where = { user_id: req.userId };
    if (type) where.type = type;
    if (is_read !== undefined) where.is_read = is_read;
    const { count, rows } = await Notification.findAndCountAll({
      where, limit, offset,
      order: [['is_read', 'ASC'], ['created_at', 'DESC']],
    });
    const typeNames = { 1: '库存预警', 2: '盘点审核', 3: '审核结果', 4: '盘点提醒' };
    const items = rows.map(n => ({ ...n.toJSON(), type_name: typeNames[n.type] || '未知' }));
    res.json(success(getPagingData(count, items, page, limit)));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// GET /api/v1/notifications/unread-count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const unread_count = await Notification.count({ where: { user_id: req.userId, is_read: 0 } });
    res.json(success({ unread_count }));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, user_id: req.userId } });
    if (!notification) {
      return res.status(404).json(fail(404, '通知不存在'));
    }
    await notification.update({ is_read: 1 });
    res.json(success(null, '标记成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.update({ is_read: 1 }, { where: { user_id: req.userId, is_read: 0 } });
    res.json(success(null, '全部标记已读成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
