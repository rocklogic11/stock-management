const jwt = require('jsonwebtoken');
const config = require('../config');
const { User, Role } = require('../models');

const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ code: 401, message: '未提供认证Token' });
    }
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findByPk(decoded.id, {
      include: [{ model: Role, as: 'role' }],
      attributes: { exclude: ['password'] },
    });
    if (!user || user.status !== 1) {
      return res.status(401).json({ code: 401, message: '用户不存在或已禁用' });
    }
    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, message: 'Token已过期' });
    }
    return res.status(401).json({ code: 401, message: 'Token无效' });
  }
};

const checkPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user || !user.role || !user.role.permissions) {
        return res.status(403).json({ code: 403, message: '无权限' });
      }
      const permissions = typeof user.role.permissions === 'string'
        ? JSON.parse(user.role.permissions)
        : user.role.permissions;
      if (permissions.permission_manage === true) {
        return next(); // 店主拥有所有权限
      }
      if (permissions[permissionKey] !== true) {
        return res.status(403).json({ code: 403, message: '无权限执行此操作' });
      }
      next();
    } catch (error) {
      return res.status(500).json({ code: 500, message: '权限检查失败' });
    }
  };
};

module.exports = { auth, checkPermission };
