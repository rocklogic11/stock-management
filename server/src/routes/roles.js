const express = require('express');
const { Role, OperationLog } = require('../models');
const { auth, checkPermission } = require('../middleware/auth');
const { success, fail } = require('../utils/helpers');

const router = express.Router();

// GET /api/v1/roles
router.get('/', auth, async (req, res) => {
  try {
    const roles = await Role.findAll({ order: [['id', 'ASC']] });
    res.json(success(roles));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/roles
router.post('/', auth, checkPermission('permission_manage'), async (req, res) => {
  try {
    const { role_name, permissions, description } = req.body;
    if (!role_name) {
      return res.status(400).json(fail(400, '角色名称不能为空'));
    }
    const role = await Role.create({ role_name, permissions, description });
    await OperationLog.create({ user_id: req.userId, operation_type: '角色管理', operation_detail: `新增角色: ${role_name}` });
    res.json(success(role, '创建成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// PUT /api/v1/roles/:id
router.put('/:id', auth, checkPermission('permission_manage'), async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) {
      return res.status(404).json(fail(404, '角色不存在'));
    }
    const { role_name, permissions, description } = req.body;
    await role.update({ role_name, permissions, description });
    await OperationLog.create({ user_id: req.userId, operation_type: '角色管理', operation_detail: `更新角色: ${role.role_name}` });
    res.json(success(null, '更新成功'));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
