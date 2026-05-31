const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { sequelize } = require('./models');

// 路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const inboundOrderRoutes = require('./routes/inbound-orders');
const inventoryOrderRoutes = require('./routes/inventory-orders');
const stockRoutes = require('./routes/stock');
const stockAlertRoutes = require('./routes/stock-alerts');
const analyticsRoutes = require('./routes/analytics');
const notificationRoutes = require('./routes/notifications');
const operationLogRoutes = require('./routes/operation-logs');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 前端静态文件（生产模式）
const frontendDist = path.join(__dirname, '../../web/dist');
app.use(express.static(frontendDist));

// API路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inbound-orders', inboundOrderRoutes);
app.use('/api/v1/inventory-orders', inventoryOrderRoutes);
app.use('/api/v1/stock', stockRoutes);
app.use('/api/v1/stock-alerts', stockAlertRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/operation-logs', operationLogRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// SPA 路由回退（必须放在 API 路由之后）
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../../web/dist/index.html'), (err) => {
    if (err) next();
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

// 启动
const PORT = config.port;
async function start() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');
    // SQLite不支持alter模式，仅验证模型是否匹配
    if (process.env.DB_DIALECT !== 'sqlite') {
      await sequelize.sync({ alter: true });
      console.log('数据库模型同步完成');
    }
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

start();
