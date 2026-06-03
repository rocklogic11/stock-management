function parsePermissions(user) {
  const permissions = user?.role?.permissions;
  if (!permissions) return {};
  if (typeof permissions === 'string') {
    try {
      return JSON.parse(permissions);
    } catch (error) {
      return {};
    }
  }
  return permissions;
}

function canViewCost(user) {
  const permissions = parsePermissions(user);
  return Boolean(user?.role?.role_name === '店主' || permissions.permission_manage);
}

function toPlain(value) {
  return value && typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function removeKeys(target, keys) {
  if (!target) return target;
  for (const key of keys) {
    delete target[key];
  }
  return target;
}

module.exports = {
  canViewCost,
  removeKeys,
  toPlain,
};
