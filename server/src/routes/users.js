const express = require('express');
const bcrypt = require('bcryptjs');
const { User, Role, OperationLog } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { getPagination, getPagingData, success, fail } = require('../utils/helpers');

const router = express.Router();

// GET /api/v1/users
router.get('/', auth, checkPermission('permission_manage'), async (req, res) => {
  try {
    const { page = 1, page_size = 20, keyword } = req.query;
    const { limit, offset } = getPagination(page, page_size);
    const where = {};
    if (keyword) {
      where[require('sequelize').Op.or] = [
        { username: { [require('sequelize').Op.like]: `%${keyword}%` } },
        { real_name: { [require('sequelize').Op.like]: `%${keyword}%` } },
      ];
    }
    const { count, rows } = await User.findAndCountAll({
      where, limit, offset,
      include: [{ model: Role, as: 'role', attributes: ['id', 'role_name'] }],
      attributes: { exclude: ['password'] },
      order: [['id', 'ASC']],
    });
    res.json(success(getPagingData(count, rows, page, limit)));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/users
router.post('/', auth, checkPermission('permission_manage'), async (req, res) => {
  try {
    const { username, password, real_name, phone, role_id } = req.body;
    if (!username || !password) {
      return res.status(400).json(fail(400, '用户名和密码不能为空'));
    }
    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return res.status(400).json(fail(400, '用户名已存在'));
    }
    const user = await User.create({ username, password, real_name, phone, role_id: role_id || 2 });
    await OperationLog.create({ user_id: req.userId, operation_type: '用户管理', operation_detail: `新增用户: ${username}` });
    res.json(success({ id: user.id, username: user.username, real_name: user.real_name }, '创建成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/users/:id
router.put('/:id', auth, checkPermission('permission_manage'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json(fail(404, '用户不存在'));
    }
    const { real_name, phone, role_id, status } = req.body;
    await user.update({ real_name, phone, role_id, status });
    await OperationLog.create({ user_id: req.userId, operation_type: '用户管理', operation_detail: `更新用户: ${user.username}` });
    res.json(success(null, '更新成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// DELETE /api/v1/users/:id
router.delete('/:id', auth, checkPermission('permission_manage'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json(fail(404, '用户不存在'));
    }
    await user.update({ status: 0 });
    await OperationLog.create({ user_id: req.userId, operation_type: '用户管理', operation_detail: `禁用用户: ${user.username}` });
    res.json(success(null, '禁用成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/users/:id/password
router.put('/:id/password', auth, async (req, res) => {
  try {
    if (parseInt(req.params.id) !== req.userId && !req.user.role.permissions?.permission_manage) {
      return res.status(403).json(fail(403, '无权修改他人密码'));
    }
    const { old_password, new_password } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json(fail(404, '用户不存在'));
    }
    // 如果修改自己的密码，需验证旧密码
    if (parseInt(req.params.id) === req.userId) {
      if (!old_password) {
        return res.status(400).json(fail(400, '旧密码不能为空'));
      }
      const isMatch = await bcrypt.compare(old_password, user.password);
      if (!isMatch) {
        return res.status(400).json(fail(1006, '旧密码错误'));
      }
    }
    if (!new_password || new_password.length < 6) {
      return res.status(400).json(fail(1007, '新密码至少6个字符'));
    }
    if (!/[a-zA-Z]/.test(new_password) || !/[0-9]/.test(new_password)) {
      return res.status(400).json(fail(1007, '新密码需包含字母和数字'));
    }
    await user.update({ password: new_password });
    await OperationLog.create({ user_id: req.userId, operation_type: '修改密码', operation_detail: `修改密码: ${user.username}` });
    res.json(success(null, '密码修改成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
