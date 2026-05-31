const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { User, Role } = require('../models');
const { auth } = require('../middleware/auth');
const { success, fail } = require('../utils/helpers');

const router = express.Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json(fail(400, '用户名和密码不能为空'));
    }
    const user = await User.findOne({ where: { username }, include: [{ model: Role, as: 'role' }] });
    if (!user) {
      return res.status(401).json(fail(401, '用户名或密码错误'));
    }
    if (user.status !== 1) {
      return res.status(401).json(fail(401, '账号已被禁用'));
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json(fail(401, '用户名或密码错误'));
    }
    // 更新最后登录时间
    await user.update({ last_login_time: new Date() });
    const token = jwt.sign({ id: user.id, username: user.username }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    const refreshToken = jwt.sign({ id: user.id }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
    const permissions = typeof user.role.permissions === 'string' ? JSON.parse(user.role.permissions) : user.role.permissions;
    res.json(success({
      token,
      refresh_token: refreshToken,
      expires_in: 86400,
      user: {
        id: user.id,
        username: user.username,
        real_name: user.real_name,
        role: user.role.role_name,
        permissions,
      },
    }));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(fail(500, '服务器错误'));
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(401).json(fail(401, '缺少刷新Token'));
    }
    const decoded = jwt.verify(refresh_token, config.jwt.refreshSecret);
    const user = await User.findByPk(decoded.id);
    if (!user || user.status !== 1) {
      return res.status(401).json(fail(401, '用户不存在或已禁用'));
    }
    const token = jwt.sign({ id: user.id, username: user.username }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.json(success({ token, expires_in: 86400 }));
  } catch (error) {
    res.status(401).json(fail(401, '刷新Token无效'));
  }
});

// GET /api/v1/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      include: [{ model: Role, as: 'role' }],
      attributes: { exclude: ['password'] },
    });
    if (!user) {
      return res.status(404).json(fail(404, '用户不存在'));
    }
    const permissions = typeof user.role.permissions === 'string' ? JSON.parse(user.role.permissions) : user.role.permissions;
    res.json(success({
      id: user.id,
      username: user.username,
      real_name: user.real_name,
      phone: user.phone,
      role: {
        id: user.role.id,
        role_name: user.role.role_name,
        permissions,
      },
    }));
  } catch (error) {
    res.status(500).json(fail(500, '服务器错误'));
  }
});

module.exports = router;
