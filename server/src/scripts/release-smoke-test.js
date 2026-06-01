const assert = require('assert');

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const ADMIN_USER = process.env.SMOKE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'admin123';

const state = {
  token: null,
  createdProductId: null,
};

async function request(method, path, body, expectedStatuses = [200]) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`${method} ${path} returned non-JSON response: ${text.slice(0, 200)}`);
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} expected ${expectedStatuses.join('/')} but got ${response.status}: ${text}`);
  }

  return { response, payload };
}

function expectApiOk(result, label) {
  assert(result.payload, `${label}: empty response payload`);
  assert.strictEqual(result.payload.code, 200, `${label}: api code should be 200`);
  return result.payload.data;
}

async function cleanup() {
  if (state.createdProductId && state.token) {
    try {
      await request('DELETE', `/api/v1/products/${state.createdProductId}`, undefined, [200, 404]);
    } catch (error) {
      console.warn(`[cleanup] failed to archive smoke product ${state.createdProductId}: ${error.message}`);
    }
  }

  if (process.env.SMOKE_DB_CLEANUP !== 'false') {
    try {
      const { Op } = require('sequelize');
      const { Product, sequelize } = require('../models');
      await Product.destroy({
        where: {
          [Op.or]: [
            { product_name: { [Op.like]: 'release smoke product%' } },
            { product_name: { [Op.like]: 'release duplicate barcode%' } },
          ],
        },
        force: true,
      });
      await sequelize.close();
    } catch (error) {
      console.warn(`[cleanup] failed to hard-delete smoke products: ${error.message}`);
    }
  }
}

async function run() {
  console.log(`[smoke] target=${BASE_URL}`);

  const health = await request('GET', '/api/health', undefined, [200]);
  assert.strictEqual(health.payload.code, 200, 'health api code should be 200');

  const login = await request('POST', '/api/v1/auth/login', {
    username: ADMIN_USER,
    password: ADMIN_PASSWORD,
  });
  const loginData = expectApiOk(login, 'login');
  assert(loginData.token, 'login token is required');
  state.token = loginData.token;

  const categories = expectApiOk(await request('GET', '/api/v1/categories'), 'categories');
  assert(Array.isArray(categories), 'categories should be an array');
  assert(categories.length > 0, 'categories must not be empty; product creation depends on category_id');
  const categoryId = categories[0].id;

  const productList = expectApiOk(await request('GET', '/api/v1/products?page=1&page_size=5'), 'products list');
  assert(Array.isArray(productList.items), 'products list should contain items array');

  const suffix = Date.now();
  const barcode = `SMOKE-${suffix}`;
  const createData = expectApiOk(await request('POST', '/api/v1/products', {
    product_name: `release smoke product ${suffix}`,
    category_id: categoryId,
    cost_price: 1.23,
    retail_price: 9.99,
    stock_quantity: 2,
    barcode,
    images: [
      '/uploads/products/release-smoke-1.jpg',
      '/uploads/products/release-smoke-2.jpg',
      '/uploads/products/release-smoke-3.jpg',
      '/uploads/products/release-smoke-4.jpg',
    ],
  }), 'create product');
  assert(createData.id, 'created product id is required');
  state.createdProductId = createData.id;
  assert.strictEqual(createData.barcode, barcode, 'created product barcode should match');

  await request('POST', '/api/v1/products', {
    product_name: `release duplicate barcode ${suffix}`,
    category_id: categoryId,
    barcode,
    images: [],
  }, [400]);

  await request('PUT', `/api/v1/products/${state.createdProductId}`, {
    images: [
      '/uploads/products/release-smoke-1.jpg',
      '/uploads/products/release-smoke-2.jpg',
      '/uploads/products/release-smoke-3.jpg',
      '/uploads/products/release-smoke-4.jpg',
      '/uploads/products/release-smoke-5.jpg',
    ],
  }, [400]);

  expectApiOk(await request('PUT', `/api/v1/products/${state.createdProductId}`, {
    barcode: `${barcode}-EDITED`,
    images: ['/uploads/products/release-smoke-edited.jpg'],
  }), 'edit product');

  const detail = expectApiOk(await request('GET', `/api/v1/products/${state.createdProductId}`), 'product detail');
  assert.strictEqual(detail.barcode, `${barcode}-EDITED`, 'edited barcode should be returned');
  assert(Array.isArray(detail.images), 'product images should be an array');
  assert.strictEqual(detail.images.length, 1, 'edited image array should contain one item');

  const dashboard = expectApiOk(await request('GET', '/api/v1/dashboard'), 'dashboard');
  assert(Object.prototype.hasOwnProperty.call(dashboard, 'product_count'), 'dashboard product_count is required');

  await cleanup();
  state.createdProductId = null;

  console.log('[smoke] passed');
}

run()
  .catch(async (error) => {
    console.error(`[smoke] failed: ${error.stack || error.message}`);
    await cleanup();
    process.exit(1);
  });
