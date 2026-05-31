const { Op } = require('sequelize');
const crypto = require('crypto');

// 分页参数处理
const getPagination = (page = 1, pageSize = 20) => {
  const limit = Math.min(Math.max(parseInt(pageSize), 1), 100);
  const offset = (Math.max(parseInt(page), 1) - 1) * limit;
  return { limit, offset };
};

// 分页响应格式
const getPagingData = (count, rows, page, limit) => {
  return {
    total: count,
    page: parseInt(page),
    page_size: limit,
    total_pages: Math.ceil(count / limit),
    items: rows,
  };
};

// 生成入库单号
const generateInboundOrderNo = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `RK-${dateStr}-${random}`;
};

// 生成盘点单号
const generateInventoryOrderNo = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `PD-${dateStr}-${random}`;
};

// 生成SKU编码（使用crypto随机，确保并发唯一性）
const generateSkuCode = () => {
  const random = crypto.randomBytes(4).toString('hex');
  return `KW-${random}`;
};

// 统一响应格式
const success = (data = null, message = 'success') => {
  return { code: 200, message, data };
};

const fail = (code = 400, message = '错误', errors = null) => {
  const result = { code, message };
  if (errors) result.errors = errors;
  return result;
};

module.exports = {
  getPagination,
  getPagingData,
  generateInboundOrderNo,
  generateInventoryOrderNo,
  generateSkuCode,
  success,
  fail,
};
