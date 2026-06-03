const assert = require('assert');

const BASE_URL = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const ADMIN_USER = process.env.SMOKE_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'admin123';
const CLERK_USER = process.env.SMOKE_CLERK_USER || 'clerk';
const CLERK_PASSWORD = process.env.SMOKE_CLERK_PASSWORD || 'clerk123';

const state = {
  adminToken: null,
  clerkToken: null,
  productId: null,
  inboundOrderIds: [],
  inventoryOrderIds: [],
};

async function request(method, path, body, token, expectedStatuses = [200]) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} expected ${expectedStatuses.join('/')} but got ${response.status}: ${text}`);
  }
  return payload;
}

function expectOk(payload, label) {
  assert(payload, `${label}: empty payload`);
  assert.strictEqual(payload.code, 200, `${label}: code should be 200`);
  return payload.data;
}

async function login(username, password) {
  const data = expectOk(await request('POST', '/api/v1/auth/login', { username, password }, null), `login ${username}`);
  assert(data.token, `login ${username}: token required`);
  return data.token;
}

function assertNoSensitiveFields(value, path = 'data') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;

  for (const key of Object.keys(value)) {
    assert(!['cost_price', 'unit_price', 'total_price', 'total_amount', 'difference_amount'].includes(key), `${path}.${key} should be filtered`);
    assertNoSensitiveFields(value[key], `${path}.${key}`);
  }
}

async function cleanup() {
  if (process.env.SMOKE_DB_CLEANUP === 'false') return;
  try {
    const { InboundOrder, InboundOrderItem, InventoryOrder, InventoryOrderItem, Product, StockMovement, sequelize } = require('../models');

    for (const id of state.inboundOrderIds) {
      await InboundOrderItem.destroy({ where: { order_id: id }, force: true });
      await InboundOrder.destroy({ where: { id }, force: true });
    }
    for (const id of state.inventoryOrderIds) {
      await InventoryOrderItem.destroy({ where: { order_id: id }, force: true });
      await InventoryOrder.destroy({ where: { id }, force: true });
    }
    if (state.productId) {
      await StockMovement.destroy({ where: { product_id: state.productId }, force: true });
      await Product.destroy({ where: { id: state.productId }, force: true });
    }
    await sequelize.close();
  } catch (error) {
    console.warn(`[cleanup] failed: ${error.message}`);
  }
}

async function run() {
  console.log(`[p0] target=${BASE_URL}`);
  state.adminToken = await login(ADMIN_USER, ADMIN_PASSWORD);
  state.clerkToken = await login(CLERK_USER, CLERK_PASSWORD);

  const categories = expectOk(await request('GET', '/api/v1/categories', undefined, state.adminToken), 'categories');
  assert(categories.length > 0, 'at least one category is required');

  const suffix = Date.now();
  const product = expectOk(await request('POST', '/api/v1/products', {
    product_name: `p0 regression product ${suffix}`,
    category_id: categories[0].id,
    cost_price: 10,
    retail_price: 20,
    stock_quantity: 5,
    barcode: `P0-${suffix}`,
    images: [],
  }, state.adminToken), 'create product');
  state.productId = product.id;

  const beforeInbound = expectOk(await request('GET', `/api/v1/products/${state.productId}`, undefined, state.adminToken), 'product before inbound');
  assert.strictEqual(Number(beforeInbound.stock_quantity), 5, 'initial stock should be 5');

  const clerkProduct = expectOk(await request('GET', `/api/v1/products/${state.productId}`, undefined, state.clerkToken), 'clerk product detail');
  assertNoSensitiveFields(clerkProduct, 'clerkProduct');

  const draftOrder = expectOk(await request('POST', '/api/v1/inbound-orders', {
    status: 1,
    remark: 'p0 regression should still create draft',
    items: [{ product_id: state.productId, quantity: 3, unit_price: 11 }],
  }, state.adminToken), 'create inbound draft');
  state.inboundOrderIds.push(draftOrder.id);

  const draftDetail = expectOk(await request('GET', `/api/v1/inbound-orders/${draftOrder.id}`, undefined, state.adminToken), 'inbound draft detail');
  assert.strictEqual(Number(draftDetail.status), 2, 'create inbound must always produce draft status');

  const afterDraft = expectOk(await request('GET', `/api/v1/products/${state.productId}`, undefined, state.adminToken), 'product after draft');
  assert.strictEqual(Number(afterDraft.stock_quantity), 5, 'draft inbound must not change stock');

  expectOk(await request('PUT', `/api/v1/inbound-orders/${draftOrder.id}/confirm`, undefined, state.adminToken), 'confirm inbound');
  const afterConfirm = expectOk(await request('GET', `/api/v1/products/${state.productId}`, undefined, state.adminToken), 'product after confirm');
  assert.strictEqual(Number(afterConfirm.stock_quantity), 8, 'confirmed inbound should add stock');

  const clerkInboundDetail = expectOk(await request('GET', `/api/v1/inbound-orders/${draftOrder.id}`, undefined, state.clerkToken), 'clerk inbound detail');
  assertNoSensitiveFields(clerkInboundDetail, 'clerkInboundDetail');

  const inventoryOrder = expectOk(await request('POST', '/api/v1/inventory-orders', {
    inventory_type: 1,
    items: [{ product_id: state.productId, actual_quantity: 7 }],
    remark: 'p0 regression inventory conflict',
  }, state.adminToken), 'create inventory order');
  state.inventoryOrderIds.push(inventoryOrder.id);
  expectOk(await request('PUT', `/api/v1/inventory-orders/${inventoryOrder.id}/submit`, undefined, state.adminToken), 'submit inventory order');

  const conflictInbound = expectOk(await request('POST', '/api/v1/inbound-orders', {
    remark: 'p0 regression conflict stock change',
    items: [{ product_id: state.productId, quantity: 1, unit_price: 11 }],
  }, state.adminToken), 'create conflict inbound');
  state.inboundOrderIds.push(conflictInbound.id);
  expectOk(await request('PUT', `/api/v1/inbound-orders/${conflictInbound.id}/confirm`, undefined, state.adminToken), 'confirm conflict inbound');

  const conflict = await request('PUT', `/api/v1/inventory-orders/${inventoryOrder.id}/audit`, {
    audit_status: 1,
    audit_opinion: 'p0 regression approve should conflict',
  }, state.adminToken, [409]);
  assert.strictEqual(conflict.code, 1006, 'inventory conflict should use code 1006');
  assert(Array.isArray(conflict.errors?.conflicts), 'conflict response should include conflicts');
  assert(conflict.errors.conflicts.length > 0, 'conflict list should not be empty');

  const clerkInventory = expectOk(await request('GET', `/api/v1/inventory-orders/${inventoryOrder.id}`, undefined, state.clerkToken), 'clerk inventory detail');
  assertNoSensitiveFields(clerkInventory, 'clerkInventory');

  await cleanup();
  state.productId = null;
  console.log('[p0] passed');
}

run().catch(async (error) => {
  console.error(`[p0] failed: ${error.stack || error.message}`);
  await cleanup();
  process.exit(1);
});
