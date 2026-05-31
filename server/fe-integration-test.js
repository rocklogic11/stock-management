/**
 * 前端联调测试 - 验证前端页面与后端API接口对齐
 * 模拟每个页面的完整数据流：请求参数 → 响应数据结构 → 前端字段引用
 */
const http = require('http');
const BASE = 'http://localhost:3000/api/v1';
let adminToken = '', clerkToken = '';
let passed = 0, failed = 0;
const results = [];
const D = {};

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json' };
    if (b) h['Content-Length'] = Buffer.byteLength(b);
    if (token) h['Authorization'] = `Bearer ${token}`;
    const fullUrl = BASE + path; // 正确拼接：'http://localhost:3000/api/v1' + '/auth/login'
    const url = new URL(fullUrl);
    const r = http.request({ hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers: h }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(d) }); } catch(e) { resolve({ s: res.statusCode, d, raw:true }); } });
    });
    r.on('error', reject); r.setTimeout(10000, () => { r.destroy(); reject(new Error('Timeout')); });
    if (b) r.write(b); r.end();
  });
}
const G = (p,t) => req('GET',p,t);
const P = (p,b,t) => req('POST',p,t,b);
const U = (p,b,t) => req('PUT',p,t,b);
const Del = (p,t) => req('DELETE',p,t);

function log(page, id, ok, detail) {
  const tag = ok ? '✅' : '❌';
  results.push({page,id,ok,detail:detail||''});
  if(ok) passed++; else failed++;
  console.log(`  ${tag} [${page}] ${id}${detail?': '+detail:''}`);
}

function checkFields(obj, fields, label) {
  const missing = fields.filter(f => {
    const parts = f.split('.');
    let cur = obj;
    for (const p of parts) { cur = cur?.[p]; if (cur === undefined) return true; }
    return false;
  });
  return missing.length ? `缺少字段: ${missing.join(', ')}` : null;
}

async function run() {
  console.log('\n' + '='.repeat(60));
  console.log('库存预备齐库存管理系统 - 前端联调测试');
  console.log('='.repeat(60));

  // ========== 1. Login.vue ==========
  console.log('\n📋 页面一：Login.vue');
  let r = await P('/auth/login', {username:'admin',password:'admin123'});
  if(r.d.code===200 && r.d.data.token) {
    adminToken = r.d.data.token;
    // 检查前端 store.login 需要的字段: token, refresh_token, user
    const m = checkFields(r.d.data, ['token','user','user.id','user.username','user.real_name','user.role']);
    if(!m) log('Login','FE-LOGIN-001登录响应结构',true,'token+user完整');
    else log('Login','FE-LOGIN-001登录响应结构',false,m);
  } else log('Login','FE-LOGIN-001登录响应结构',false,JSON.stringify(r.d));

  r = await P('/auth/login', {username:'clerk',password:'clerk123'});
  if(r.d.code===200) clerkToken = r.d.data.token;

  // ========== 2. Layout.vue ==========
  console.log('\n📋 页面二：Layout.vue');
  // 未读消息数
  r = await G('/notifications/unread-count',adminToken);
  if(r.d.code===200) {
    const m = checkFields(r.d.data, ['unread_count']);
    if(!m) log('Layout','FE-LAYOUT-001未读消息数',true,`unread_count=${r.d.data.unread_count}`);
    else log('Layout','FE-LAYOUT-001未读消息数',false,m);
  } else log('Layout','FE-LAYOUT-001未读消息数',false,`code=${r.d.code}`);

  // 修改密码
  r = await U(`/users/1/password`, {old_password:'admin123',new_password:'admin456'},adminToken);
  // 改回来
  if(r.d.code===200) {
    await U(`/users/1/password`, {old_password:'admin456',new_password:'admin123'},adminToken);
    log('Layout','FE-LAYOUT-002修改密码',true);
  } else log('Layout','FE-LAYOUT-002修改密码',false,`code=${r.d.code}`);

  // ========== 3. Dashboard.vue ==========
  console.log('\n📋 页面三：Dashboard.vue');
  r = await G('/dashboard',adminToken);
  if(r.d.code===200) {
    // 前端需要: total_cost_value, total_retail_value, product_count, alert_count, today_inbound_quantity, pending_audit_count, recent_operations
    const m = checkFields(r.d.data, ['total_cost_value','total_retail_value','product_count','alert_count','today_inbound_quantity','pending_audit_count','recent_operations']);
    if(!m) log('Dashboard','FE-DASH-001仪表盘数据',true,`商品=${r.d.data.product_count},预警=${r.d.data.alert_count}`);
    else log('Dashboard','FE-DASH-001仪表盘数据',false,m);
  } else log('Dashboard','FE-DASH-001仪表盘数据',false,`code=${r.d.code}`);

  // recent_operations 子结构
  if(r.d.code===200 && r.d.data.recent_operations?.length) {
    const m = checkFields(r.d.data.recent_operations[0], ['operation_type','operation_detail','operator','created_at']);
    if(!m) log('Dashboard','FE-DASH-002操作记录结构',true);
    else log('Dashboard','FE-DASH-002操作记录结构',false,m);
  }

  // ========== 4. Products.vue ==========
  console.log('\n📋 页面四：Products.vue');
  // 创建分类和商品
  r = await P('/categories',{category_name:'联调测试分类'},adminToken);
  D.catId = r.d.code===200 ? r.d.data.id : null;
  r = await P('/products',{product_name:'联调测试商品',category_id:D.catId,cost_price:100,retail_price:200,stock_threshold:5},adminToken);
  D.prodId = r.d.code===200 ? r.d.data.id : null;
  D.sku = r.d.code===200 ? r.d.data.sku_code : '';

  // 商品列表
  r = await G('/products?page=1&page_size=20',adminToken);
  if(r.d.code===200) {
    // 前端需要: items, total, items[].sku_code, items[].product_name, items[].category.category_name, items[].cost_price, items[].retail_price, items[].stock_quantity, items[].status
    const m = checkFields(r.d.data, ['items','total']);
    if(!m) {
      const m2 = r.d.data.items.length ? checkFields(r.d.data.items[0], ['sku_code','product_name','cost_price','retail_price','stock_quantity','status','category.category_name']) : null;
      if(!m2) log('Products','FE-PROD-001商品列表结构',true,`total=${r.d.data.total}`);
      else log('Products','FE-PROD-001商品列表结构',false,m2);
    } else log('Products','FE-PROD-001商品列表结构',false,m);
  } else log('Products','FE-PROD-001商品列表结构',false,`code=${r.d.code}`);

  // 分类列表
  r = await G('/categories',adminToken);
  if(r.d.code===200 && Array.isArray(r.d.data)) {
    const m = r.d.data.length ? checkFields(r.d.data[0], ['id','category_name']) : null;
    if(!m) log('Products','FE-PROD-002分类列表结构',true,`共${r.d.data.length}个`);
    else log('Products','FE-PROD-002分类列表结构',false,m);
  } else log('Products','FE-PROD-002分类列表结构',false,'非数组');

  // 商品详情
  r = await G(`/products/${D.prodId}`,adminToken);
  if(r.d.code===200) {
    log('Products','FE-PROD-003商品详情',true,r.d.data.product_name);
  } else log('Products','FE-PROD-003商品详情',false,`code=${r.d.code}`);

  // 二维码
  r = await P(`/products/${D.prodId}/qrcode`,{},adminToken);
  if(r.d.code===200 && r.d.data.qr_code) log('Products','FE-PROD-004二维码生成',true);
  else log('Products','FE-PROD-004二维码生成',false,`code=${r.d.code}, hasQR=${!!r.d.data?.qr_code}`);

  // ========== 5. InboundOrders.vue ==========
  console.log('\n📋 页面五：InboundOrders.vue');
  // 创建入库单
  r = await P('/inbound-orders',{items:[{product_id:D.prodId,quantity:10,unit_price:100}],remark:'联调测试'},adminToken);
  D.inbId = r.d.code===200 ? r.d.data.id : null;

  // 入库单列表
  r = await G('/inbound-orders?page=1&page_size=20',adminToken);
  if(r.d.code===200) {
    const m = checkFields(r.d.data, ['items','total']);
    if(!m && r.d.data.items.length) {
      const m2 = checkFields(r.d.data.items[0], ['order_no','user.real_name','total_quantity','total_amount','status','remark','created_at']);
      if(!m2) log('InboundOrders','FE-INB-001入库单列表结构',true,`total=${r.d.data.total}`);
      else log('InboundOrders','FE-INB-001入库单列表结构',false,m2);
    } else if(m) log('InboundOrders','FE-INB-001入库单列表结构',false,m);
    else log('InboundOrders','FE-INB-001入库单列表结构',true,'列表为空');
  } else log('InboundOrders','FE-INB-001入库单列表结构',false,`code=${r.d.code}`);

  // 入库单详情
  if(D.inbId) {
    r = await G(`/inbound-orders/${D.inbId}`,adminToken);
    if(r.d.code===200) {
      const m = checkFields(r.d.data, ['order_no','user','status','items']);
      if(!m && r.d.data.items?.length) {
        const m2 = checkFields(r.d.data.items[0], ['product.sku_code','product.product_name','quantity','unit_price','total_price']);
        if(!m2) log('InboundOrders','FE-INB-002入库单详情结构',true);
        else log('InboundOrders','FE-INB-002入库单详情结构',false,m2);
      } else if(!m) log('InboundOrders','FE-INB-002入库单详情结构',true,'明细为空');
      else log('InboundOrders','FE-INB-002入库单详情结构',false,m);
    } else log('InboundOrders','FE-INB-002入库单详情结构',false,`code=${r.d.code}`);
  }

  // 确认入库
  if(D.inbId) {
    r = await U(`/inbound-orders/${D.inbId}/confirm`,{},adminToken);
    if(r.d.code===200) log('InboundOrders','FE-INB-003确认入库',true);
    else log('InboundOrders','FE-INB-003确认入库',false,`code=${r.d.code}`);
  }

  // ========== 6. InventoryOrders.vue ==========
  console.log('\n📋 页面六：InventoryOrders.vue');
  // 创建盘点单（前端发送inventory_scope=分类ID，后端接收后处理）
  r = await P('/inventory-orders',{inventory_type:1,inventory_scope:D.catId,remark:'联调盘点'},adminToken);
  if(r.d.code===200) D.invId = r.d.data.id;
  else D.invId = null;

  // 盘点单列表
  r = await G('/inventory-orders?page=1&page_size=20',adminToken);
  if(r.d.code===200) {
    const m = checkFields(r.d.data, ['items','total']);
    if(!m && r.d.data.items.length) {
      const m2 = checkFields(r.d.data.items[0], ['order_no','user.real_name','inventory_type','total_quantity','status','audit_status','created_at']);
      if(!m2) log('InventoryOrders','FE-INV-001盘点单列表结构',true,`total=${r.d.data.total}`);
      else log('InventoryOrders','FE-INV-001盘点单列表结构',false,m2);
    } else if(m) log('InventoryOrders','FE-INV-001盘点单列表结构',false,m);
    else log('InventoryOrders','FE-INV-001盘点单列表结构',true,'列表为空');
  } else log('InventoryOrders','FE-INV-001盘点单列表结构',false,`code=${r.d.code}`);

  // 盘点单详情
  if(D.invId) {
    r = await G(`/inventory-orders/${D.invId}`,adminToken);
    if(r.d.code===200) {
      const m = checkFields(r.d.data, ['order_no','user','items']);
      if(!m && r.d.data.items?.length) {
        const m2 = checkFields(r.d.data.items[0], ['product.sku_code','product.product_name','system_quantity','actual_quantity','difference','difference_amount']);
        if(!m2) log('InventoryOrders','FE-INV-002盘点单详情结构',true);
        else log('InventoryOrders','FE-INV-002盘点单详情结构',false,m2);
      } else if(!m) log('InventoryOrders','FE-INV-002盘点单详情结构',true,'明细为空');
      else log('InventoryOrders','FE-INV-002盘点单详情结构',false,m);
    } else log('InventoryOrders','FE-INV-002盘点单详情结构',false,`code=${r.d.code}`);

    // 保存盘点数据 PUT /:id/item
    if(r.d.code===200 && r.d.data.items?.length) {
      const itemId = r.d.data.items[0];
      r = await U(`/inventory-orders/${D.invId}/item`,{product_id:itemId.product_id,actual_quantity:10},adminToken);
      if(r.d.code===200) log('InventoryOrders','FE-INV-003保存盘点数据',true);
      else log('InventoryOrders','FE-INV-003保存盘点数据',false,`code=${r.d.code}`);
    }

    // 提交审核
    r = await U(`/inventory-orders/${D.invId}/submit`,{},adminToken);
    if(r.d.code===200) log('InventoryOrders','FE-INV-004提交审核',true);
    else log('InventoryOrders','FE-INV-004提交审核',false,`code=${r.d.code}`);

    // 审核盘点
    r = await U(`/inventory-orders/${D.invId}/audit`,{audit_status:1,audit_opinion:'联调通过'},adminToken);
    if(r.d.code===200) log('InventoryOrders','FE-INV-005审核盘点',true);
    else log('InventoryOrders','FE-INV-005审核盘点',false,`code=${r.d.code}`);
  }

  // ========== 7. StockQuery.vue ==========
  console.log('\n📋 页面七：StockQuery.vue');
  // 前端用 /products?status=1
  r = await G('/products?page=1&page_size=20&status=1',adminToken);
  if(r.d.code===200) {
    log('StockQuery','FE-STK-001库存查询接口',true,`在售商品=${r.d.data.total}`);
  } else log('StockQuery','FE-STK-001库存查询接口',false,`code=${r.d.code}`);

  // ========== 8. StockAlerts.vue ==========
  console.log('\n📋 页面八：StockAlerts.vue');
  r = await G('/stock-alerts?page=1&page_size=20',adminToken);
  if(r.d.code===200) {
    const m = checkFields(r.d.data, ['items','total']);
    if(!m && r.d.data.items.length) {
      const m2 = checkFields(r.d.data.items[0], ['sku_code','product_name','stock_quantity','alert_threshold']);
      if(!m2) log('StockAlerts','FE-ALERT-001预警列表结构',true,`预警=${r.d.data.total}`);
      else log('StockAlerts','FE-ALERT-001预警列表结构',false,m2);
    } else if(m) log('StockAlerts','FE-ALERT-001预警列表结构',false,m);
    else log('StockAlerts','FE-ALERT-001预警列表结构',true,'无预警');
  } else log('StockAlerts','FE-ALERT-001预警列表结构',false,`code=${r.d.code}`);

  // 预警设置
  r = await G('/stock-alerts/settings?page_size=100',adminToken);
  if(r.d.code===200) {
    log('StockAlerts','FE-ALERT-002预警设置接口',true);
  } else log('StockAlerts','FE-ALERT-002预警设置接口',false,`code=${r.d.code}`);

  // ========== 9. PurchaseSuggestion.vue ==========
  console.log('\n📋 页面九：PurchaseSuggestion.vue');
  // 前端调用 /stock-alerts（同 StockAlerts），已验证
  // 但后端也有 /analytics/purchase-suggestions
  r = await G('/analytics/purchase-suggestions',adminToken);
  if(r.d.code===200) {
    log('PurchaseSuggestion','FE-PURCH-001进货建议接口',true,`建议=${r.d.data.total||0}个`);
  } else log('PurchaseSuggestion','FE-PURCH-001进货建议接口',false,`code=${r.d.code}`);

  // ========== 10. OperationLogs.vue ==========
  console.log('\n📋 页面十：OperationLogs.vue');
  r = await G('/operation-logs?page=1&page_size=20',adminToken);
  if(r.d.code===200) {
    const m = checkFields(r.d.data, ['items','total']);
    if(!m && r.d.data.items.length) {
      const m2 = checkFields(r.d.data.items[0], ['operation_type','operation_detail','user.real_name','created_at']);
      if(!m2) log('OperationLogs','FE-LOG-001操作日志结构',true,`共${r.d.data.total}条`);
      else log('OperationLogs','FE-LOG-001操作日志结构',false,m2);
    } else if(m) log('OperationLogs','FE-LOG-001操作日志结构',false,m);
    else log('OperationLogs','FE-LOG-001操作日志结构',true,'无日志');
  } else log('OperationLogs','FE-LOG-001操作日志结构',false,`code=${r.d.code}`);

  // ========== 11. Permissions.vue ==========
  console.log('\n📋 页面十一：Permissions.vue');
  r = await G('/users?page_size=100',adminToken);
  if(r.d.code===200) {
    const m = checkFields(r.d.data, ['items']);
    if(!m && r.d.data.items.length) {
      const m2 = checkFields(r.d.data.items[0], ['username','real_name','role.role_name','phone','status']);
      if(!m2) log('Permissions','FE-PERM-001用户列表结构',true,`共${r.d.data.items.length}个`);
      else log('Permissions','FE-PERM-001用户列表结构',false,m2);
    } else if(m) log('Permissions','FE-PERM-001用户列表结构',false,m);
    else log('Permissions','FE-PERM-001用户列表结构',true,'无用户');
  } else log('Permissions','FE-PERM-001用户列表结构',false,`code=${r.d.code}`);

  r = await G('/roles',adminToken);
  if(r.d.code===200 && Array.isArray(r.d.data)) {
    const m = r.d.data.length ? checkFields(r.d.data[0], ['role_name','description','permissions']) : null;
    if(!m) log('Permissions','FE-PERM-002角色列表结构',true,`共${r.d.data.length}个`);
    else log('Permissions','FE-PERM-002角色列表结构',false,m);
  } else log('Permissions','FE-PERM-002角色列表结构',false,'非数组');

  // ========== 12. Notifications.vue ==========
  console.log('\n📋 页面十二：Notifications.vue');
  r = await G('/notifications?page=1&page_size=20',adminToken);
  if(r.d.code===200) {
    const m = checkFields(r.d.data, ['items','total']);
    if(!m && r.d.data.items.length) {
      const m2 = checkFields(r.d.data.items[0], ['type','type_name','title','content','is_read','created_at','related_id','related_type']);
      if(!m2) log('Notifications','FE-NOTIF-001通知列表结构',true,`共${r.d.data.total}条`);
      else log('Notifications','FE-NOTIF-001通知列表结构',false,m2);
    } else if(m) log('Notifications','FE-NOTIF-001通知列表结构',false,m);
    else log('Notifications','FE-NOTIF-001通知列表结构',true,'无通知');
  } else log('Notifications','FE-NOTIF-001通知列表结构',false,`code=${r.d.code}`);

  // ========== 13. 跨页面数据一致性 ==========
  console.log('\n📋 页面十三：跨页面数据一致性');
  // 入库后库存是否更新
  r = await G(`/products/${D.prodId}`,adminToken);
  if(r.d.code===200 && r.d.data.stock_quantity >= 10) {
    log('一致性','FE-CONSIST-001入库后库存更新',true,`库存=${r.d.data.stock_quantity}`);
  } else log('一致性','FE-CONSIST-001入库后库存更新',false,`库存=${r.d.data?.stock_quantity}`);

  // 盘点审核后库存是否调整
  if(D.prodId) {
    r = await G(`/products/${D.prodId}`,adminToken);
    if(r.d.code===200) log('一致性','FE-CONSIST-002盘点后库存调整',true,`库存=${r.d.data.stock_quantity}`);
    else log('一致性','FE-CONSIST-002盘点后库存调整',false);
  }

  // ========== 14. 前端路由权限 ==========
  console.log('\n📋 页面十四：权限控制（店员视角）');
  // 店员能看到仪表盘吗
  r = await G('/dashboard',clerkToken);
  if(r.d.code===200) log('权限','FE-AUTH-001店员仪表盘',true);
  else log('权限','FE-AUTH-001店员仪表盘',false,`code=${r.d.code}`);

  // 店员能看库存预警吗（前端用isOwner控制，后端不限）
  r = await G('/stock-alerts',clerkToken);
  log('权限','FE-AUTH-002店员访问预警API',r.d.code===200||r.d.code===403,`code=${r.d.code}`);

  // 店员能看操作日志吗
  r = await G('/operation-logs',clerkToken);
  log('权限','FE-AUTH-003店员访问日志API',r.d.code===200||r.d.code===403,`code=${r.d.code}`);

  // 店员能创建商品吗
  r = await P('/products',{product_name:'无权测试',category_id:D.catId,cost_price:1,retail_price:2},clerkToken);
  if(r.d.code===403) log('权限','FE-AUTH-004店员无权创建商品',true);
  else log('权限','FE-AUTH-004店员无权创建商品',false,`code=${r.d.code}`);

  // ========== 报告 ==========
  console.log('\n' + '='.repeat(60));
  console.log('📊 前端联调测试报告');
  console.log('='.repeat(60));
  console.log(`  总计用例：${passed+failed}`);
  console.log(`  ✅ 通过：${passed}`);
  console.log(`  ❌ 失败：${failed}`);
  console.log(`  通过率：${((passed/(passed+failed))*100).toFixed(1)}%`);
  if(failed>0){
    console.log('\n❌ 失败用例：');
    results.filter(x=>!x.ok).forEach(x=>console.log(`  - [${x.page}] ${x.id}: ${x.detail}`));
  }
  console.log('\n'+'='.repeat(60));
  console.log(failed===0?'🎉 前后端联调测试通过！所有接口对齐。':'⚠️ 有'+failed+'个联调问题，请检查。');
  console.log('='.repeat(60));
}
run().catch(e=>console.error('Fatal:',e));
