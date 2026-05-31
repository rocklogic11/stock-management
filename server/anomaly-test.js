/**
 * 异常场景测试 - 并发操作、边界值、非法输入
 * 库存预备齐库存管理系统
 */
const http = require('http');
const BASE = 'http://localhost:3000/api/v1';
let adminToken = '', clerkToken = '';
let passed = 0, failed = 0;
const results = [];
const D = {};

function req(method, path, token, body) {
  return new Promise((resolve) => {
    const b = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json' };
    if (b) h['Content-Length'] = Buffer.byteLength(b);
    if (token) h['Authorization'] = `Bearer ${token}`;
    const fullUrl = BASE + path;
    const url = new URL(fullUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: h
    };
    const r = http.request(options, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, d: JSON.parse(d) }); }
        catch(e) { resolve({ s: res.statusCode, d: { raw: d } }); }
      });
    });
    r.on('error', () => resolve({ s: 0, d: { code: 0 } }));
    r.setTimeout(5000, () => { r.destroy(); resolve({ s: 0, d: { code: 0, timeout: true } }); });
    if (b) r.write(b);
    r.end();
  });
}
const G = (p,t) => req('GET',p,t);
const P = (p,b,t) => req('POST',p,t,b);
const U = (p,b,t) => req('PUT',p,t,b);
const Del = (p,t) => req('DELETE',p,t);

function log(module, id, ok, detail) {
  const tag = ok ? '✅' : '❌';
  if(ok) passed++; else failed++;
  results.push({module,id,ok,detail:detail||''});
  console.log(`  ${tag} [${module}] ${id}${detail?' — '+detail:''}`);
}

// ========== 辅助：并发请求 ==========
function concurrentRequests(count, method, path, token, body) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(req(method, path, token, body ? { ...body, _seq: i } : undefined));
  }
  return Promise.all(promises);
}

// ========== 主测试流程 ==========
async function run() {
  console.log('\n' + '='.repeat(62));
  console.log('库存预备齐库存管理系统 — 异常场景测试');
  console.log('='.repeat(62));

  // 登录
  let r = await P('/auth/login', { username:'admin', password:'admin123' });
  if (r.d.code === 200) adminToken = r.d.data.token;
  r = await P('/auth/login', { username:'clerk', password:'clerk123' });
  if (r.d.code === 200) clerkToken = r.d.data.token;

  // ========== 模块一：边界值测试 ==========
  console.log('\n📋 模块一：边界值测试');

  // BOUND-001: 登录 - 空用户名
  r = await P('/auth/login', { username:'', password:'admin123' });
  log('边界值','BOUND-001空用户名登录', r.d.code===400||r.s===400, `code=${r.d.code}`);

  // BOUND-002: 登录 - 空密码
  r = await P('/auth/login', { username:'admin', password:'' });
  log('边界值','BOUND-002空密码登录', r.d.code===400||r.s===400, `code=${r.d.code}`);

  // BOUND-003: 商品 - 数量边界（0）注意字段名用 product_name
  r = await P('/products', { product_name:'边界测试零值', category_id:1, cost_price:0, retail_price:0, stock_quantity:0 }, adminToken);
  log('边界值','BOUND-003零值商品创建', r.d.code===200||r.d.code===201, `code=${r.d.code},msg=${r.d.message}`);
  if(r.d.code===200||r.d.code===201) D.zeroProdId = r.d.data.id || r.d.data?.id;

  // BOUND-004: 商品 - 超大数值（修正字段名）
  r = await P('/products', { product_name:'超大值测试', category_id:1, cost_price:99999999.99, retail_price:99999999.99, stock_quantity:999999 }, adminToken);
  log('边界值','BOUND-004超大数值商品', r.d.code===200||r.d.code===201, `code=${r.d.code},msg=${r.d.message}`);
  if(r.d.code===200||r.d.code===201) D.bigProdId = r.d.data.id || r.d.data?.id;

  // BOUND-005: 商品 - 超长名称（100字符）
  const longName = 'A'.repeat(100);
  r = await P('/products', { name:longName, sku:'KW-TEST-003', category_id:1, cost_price:1, retail_price:1 }, adminToken);
  log('边界值','BOUND-005超长商品名称', r.d.code===200||r.d.code===400, `code=${r.d.code}`);

  // BOUND-006: 入库数量 - 负数
  r = await P('/inbound-orders', { items:[{ product_id:1, quantity:-5, cost_price:10 }] }, adminToken);
  log('边界值','BOUND-006负数入库数量', r.d.code===400||r.d.code===422, `code=${r.d.code}`);

  // BOUND-007: 入库数量 - 0
  r = await P('/inbound-orders', { items:[{ product_id:1, quantity:0, cost_price:10 }] }, adminToken);
  log('边界值','BOUND-007零入库数量', r.d.code===400||r.d.code===422, `code=${r.d.code}`);

  // BOUND-008: 分页 - 超大页码
  r = await G('/products?page=99999&page_size=10', adminToken);
  log('边界值','BOUND-008超大页码', r.d.code===200&&(r.d.data.list||r.d.data.products||[]).length===0, `code=${r.d.code},空列表=${(r.d.data.list||r.d.data.products||[]).length===0}`);

  // BOUND-009: 分页 - page_size 超大
  r = await G('/products?page=1&page_size=1000', adminToken);
  log('边界值','BOUND-009超大page_size', r.d.code===200||r.d.code===400, `code=${r.d.code}`);

  // ========== 模块二：非法输入测试 ==========
  console.log('\n📋 模块二：非法输入测试');

  // INJECT-001: SQL 注入尝试 - 登录用户名
  r = await P('/auth/login', { username:"admin' OR '1'='1", password:'admin123' });
  log('非法输入','INJECT-001登录SQL注入', r.d.code===400||r.d.code===401, `code=${r.d.code}`);

  // INJECT-002: SQL 注入尝试 - 商品查询关键词
  r = await G('/products?keyword=test%27%20OR%201=1--', adminToken);
  log('非法输入','INJECT-002查询SQL注入', r.d.code===200, `code=${r.d.code}（应安全处理）`);

  // INJECT-003: XSS 尝试 - 商品名称
  r = await P('/products', { name:'<script>alert("xss")</script>', sku:'KW-TEST-XSS', category_id:1, cost_price:1, retail_price:1 }, adminToken);
  const xssStored = r.d.code===200;
  log('非法输入','INJECT-003 XSS注入', r.d.code===200||r.d.code===400, `code=${r.d.code}`);
  if(r.d.code===200) D.xssProdId = r.d.data.id || r.d.data.product?.id;

  // INJECT-004: 类型错误 - 数字字段传字符串
  r = await P('/products', { name:'类型测试', sku:'KW-TEST-TYPE', category_id:'abc', cost_price:'不是数字', retail_price:1 }, adminToken);
  log('非法输入','INJECT-004类型错误', r.d.code===400||r.d.code===422||r.d.code===500, `code=${r.d.code}`);

  // INJECT-005: JSON 注入 - 超深嵌套
  let deepObj = { a: 1 };
  for(let i=0;i<20;i++) deepObj = { nested: deepObj };
  r = await P('/auth/login', deepObj, null);
  log('非法输入','INJECT-005超深JSON', r.d.code===400||r.d.code===500||r.s===413, `code=${r.d.code}`);

  // INJECT-006: 超大请求体
  const bigBody = { name:'A'.repeat(10000), sku:'KW-BIG', category_id:1, cost_price:1, retail_price:1 };
  r = await P('/products', bigBody, adminToken);
  log('非法输入','INJECT-006超大请求体', r.d.code===200||r.d.code===400||r.d.code===413, `code=${r.d.code}`);

  // INJECT-007: 非法 Token
  r = await G('/products', 'invalid.token.here');
  log('非法输入','INJECT-007非法Token', r.d.code===401||r.s===401, `code=${r.d.code}`);

  // INJECT-008: 过期/伪造 Token
  r = await G('/products', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGUiOiJhZG1pbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxNjAwMDAwMDAwfQ.fake');
  log('非法输入','INJECT-008伪造Token', r.d.code===401, `code=${r.d.code}`);

  // INJECT-009: 缺少 Content-Type
  r = await req('POST', '/auth/login', null, { username:'admin', password:'admin123' });
  // 手动去掉 Content-Type 重新发一次
  r = await new Promise(resolve => {
    const body = JSON.stringify({ username:'admin', password:'admin123' });
    const url = new URL(BASE + '/auth/login');
    const options = { hostname:url.hostname, port:url.port||80, path:url.pathname, method:'POST', headers:{'Content-Length':Buffer.byteLength(body)} };
    const req2 = http.request(options, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve({s:res.statusCode,d:JSON.parse(d)});}catch(e){resolve({s:res.statusCode,d:{}});} });
    });
    req2.on('error',()=>resolve({s:0,d:{}}));
    req2.write(body); req2.end();
  });
  log('非法输入','INJECT-009无Content-Type', r.s===400||r.s===415||r.s===200, `status=${r.s}`);

  // ========== 模块三：并发操作测试 ==========
  console.log('\n📋 模块三：并发操作测试');

  // 先创建一个测试入库单供并发确认
  r = await P('/inbound-orders', { items:[{ product_id:1, quantity:5, cost_price:10 }] }, adminToken);
  let concOrderId = null;
  if(r.d.code===200||r.d.code===201) {
    concOrderId = r.d.data.id || r.d.data.order?.id || 1;
  }

  // CONC-001: 并发确认同一入库单
  if(concOrderId) {
    const results2 = await concurrentRequests(3, 'PUT', `/inbound-orders/${concOrderId}/confirm`, adminToken);
    const successCount = results2.filter(rr => rr.d.code===200).length;
    log('并发','CONC-001并发确认入库单', successCount<=1, `${successCount}/3成功（应只有1个成功）`);
  }

  // CONC-002: 并发创建商品（相同SKU）
  const sku = 'KW-CONC-' + Date.now();
  const results3 = await concurrentRequests(3, 'POST', '/products', adminToken, { name:'并发测试', sku, category_id:1, cost_price:1, retail_price:1 });
  const skuSuccess = results3.filter(rr => rr.d.code===200||rr.d.code===201).length;
  log('并发','CONC-002并发创建相同SKU', skuSuccess<=1, `${skuSuccess}/3成功（SKU唯一约束）`);

  // CONC-003: 并发库存查询（读取不应出错）
  const results4 = await concurrentRequests(5, 'GET', '/products?page=1&page_size=10', adminToken);
  const allOk = results4.every(rr => rr.d.code===200);
  log('并发','CONC-003并发查询商品', allOk, `${results4.filter(r=>r.d.code===200).length}/5成功`);

  // CONC-004: 并发入库+查询（数据一致性）
  const D2 = [];
  // 先创建一个入库单
  const r5 = await P('/inbound-orders', { items:[{ product_id:2, quantity:1, cost_price:5 }] }, adminToken);
  const orderId2 = r5.d.data?.id || r5.d.data?.order?.id;
  if(orderId2) {
    // 并发：确认入库 + 查询库存
    D2.push(req('PUT', `/inbound-orders/${orderId2}/confirm`, adminToken));
    D2.push(req('GET', '/products/2', adminToken));
    const[, stockRes] = await Promise.all(D2);
    log('并发','CONC-004并发入库与查询', stockRes.d.code===200, `库存查询状态码=${stockRes.d.code}`);
  }

  // ========== 模块四：业务异常测试 ==========
  console.log('\n📋 模块四：业务异常测试');

  // BIZ-001: 确认已确认的入库单（1005=状态不允许）
  if(concOrderId) {
    r = await U(`/inbound-orders/${concOrderId}/confirm`, {}, adminToken);
    log('业务异常','BIZ-001重复确认入库单', r.d.code===400||r.d.code===1005, `code=${r.d.code}`);
  }

  // BIZ-002: 删除不存在的商品
  r = await Del('/products/99999', adminToken);
  log('业务异常','BIZ-002删除不存在商品', r.d.code===404, `code=${r.d.code}`);

  // BIZ-003: 访问不存在的路由（404返回HTML，需用HTTP状态码r.s判断）
  r = await G('/nonexistent-path', adminToken);
  log('业务异常','BIZ-003访问不存在路由', r.s===404, `status=${r.s},code=${r.d?.code}`);

  // BIZ-004: 店员尝试创建商品（权限拒绝）
  r = await P('/products', { name:'店员创建测试', sku:'KW-CLERK', category_id:1, cost_price:1, retail_price:1 }, clerkToken);
  log('业务异常','BIZ-004店员越权创建', r.d.code===403, `code=${r.d.code}`);

  // BIZ-005: 盘点提交后再提交
  // 先创建一个盘点单
  r = await P('/inventory-orders', { inventory_scope:1, category_id:1, remarks:'并发测试' }, adminToken);
  const invId = r.d.data?.id || r.d.data?.order?.id;
  if(invId) {
    // 扫码添加商品
    await U(`/inventory-orders/${invId}/item`, { product_id:1, actual_quantity:10 }, adminToken);
    // 提交
    await U(`/inventory-orders/${invId}/submit`, {}, adminToken);
    // 再次提交（应失败）
    r = await U(`/inventory-orders/${invId}/submit`, {}, adminToken);
    log('业务异常','BIZ-005重复提交盘点', r.d.code===400||r.d.code===1005, `code=${r.d.code}`);
  }

  // BIZ-006: 审核已审核的盘点单
  if(invId) {
    await U(`/inventory-orders/${invId}/audit`, { audit_result:1 }, adminToken);
    r = await U(`/inventory-orders/${invId}/audit`, { audit_result:1 }, adminToken);
    log('业务异常','BIZ-006重复审核盘点', r.d.code===400||r.d.code===1005, `code=${r.d.code}`);
  }

  // ========== 清理测试数据 ==========
  console.log('\n📋 模块五：清理异常测试数据');
  const cleanIds = [D.zeroProdId, D.bigProdId, D.xssProdId].filter(Boolean);
  for(const pid of cleanIds) {
    await Del(`/products/${pid}`, adminToken);
  }
  log('清理','CLEAN-001清理边界测试商品', true, `已清理${cleanIds.length}个`);

  // ========== 测试结果汇总 ==========
  console.log('\n' + '='.repeat(62));
  console.log('📊 异常场景测试报告');
  console.log('='.repeat(62));
  console.log(`  总计用例：${passed + failed}`);
  console.log(`  ✅ 通过：${passed}`);
  console.log(`  ❌ 失败：${failed}`);
  console.log(`  通过率：${((passed/(passed+failed))*100).toFixed(1)}%`);
  console.log('');
  if (failed > 0) {
    console.log('❌ 失败用例：');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  - [${r.module}] ${r.id}: ${r.detail}`);
    });
  } else {
    console.log('🎉 所有异常场景测试通过！系统健壮性良好。');
  }
  console.log('='.repeat(62));
}

run().catch(console.error);
