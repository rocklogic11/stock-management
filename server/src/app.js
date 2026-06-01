const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { sequelize } = require('./models');

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
const uploadRoutes = require('./routes/upload');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

const frontendDist = path.join(__dirname, '../../web/dist');
app.use(express.static(frontendDist));

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
app.use('/api/v1/upload', uploadRoutes);

app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'ok', data: { status: 'running', time: new Date().toISOString() } });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ code: 500, message: 'server error' });
});

const PORT = config.port;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    // Production schema changes must run through explicit migration scripts.
    // Sequelize alter mode can attempt to sync virtual fields on MySQL.
    if (process.env.DB_SYNC_ALTER === 'true' && process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('Database schema auto-sync complete');
    } else {
      console.log('Database schema auto-sync skipped');
    }

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
}

start();
