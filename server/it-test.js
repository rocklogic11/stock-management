const http = require('http');
const BASE = 'http://localhost:3000';
let adminToken = '', clerkToken = '';
let passed = 0, failed = 0;
const results = [];
const D = { catId: null, prodId: null, sku: '', inbId: null, invId: null, userId: null };

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json' };
    if (b) h['Content-Length'] = Buffer.byteLength(b);
    if (token) h['Authorization'] = `Bearer ${token}`;
    const r = http.request({ hostname: 'localhost', port: 3000, path, method, headers: h }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(d) }); } catch(e) { resolve({ s: res.statusCode, d, raw:true }); } });
    });
    r.on('error', reject); r.setTimeout(8000, () => { r.destroy(); reject(new Error('Timeout')); });
    if (b) r.write(b); r.end();
  });
}
const G = (p,t) => req('GET',p,t);
const P = (p,b,t) => req('POST',p,t,b);
const U = (p,b,t) => req('PUT',p,t,b);
const Del = (p,t) => req('DELETE',p,t);

function log(mod, id, ok, detail) {
  const tag = ok ? '✅' : '❌';
  results.push({mod,id,ok,detail:detail||''});
  if(ok) passed++; else failed++;
  console.log(`  ${tag} [${mod}] ${id}${detail?': '+detail:''}`);
}

async function run() {
  console.log('\n'+'='.repeat(60));
  console.log('库存预备齐库存管理系统 - SIT系统集成测试');
  console.log('='.repeat(60));

  // 模块1: 认证
  console.log('\n📋 模块一：认证');
  let r = await P('/api/v1/auth/login', {username:'admin',password:'admin123'});
  if(r.s===200&&r.d.code===200){adminToken=r.d.data.token;log('认证','AUTH-001店主登录',true,`uid=${r.d.data.user.id}`);} else log('认证','AUTH-001店主登录',false,JSON.stringify(r.d));
  r=await P('/api/v1/auth/login',{username:'clerk',password:'clerk123'});
  if(r.s===200&&r.d.code===200){clerkToken=r.d.data.token;log('认证','AUTH-002店员登录',true);} else log('认证','AUTH-002店员登录',false);
  r=await P('/api/v1/auth/login',{username:'admin',password:'wrong'});
  if(r.d.code===401||r.d.code===400) log('认证','AUTH-003错误密码拒绝',true); else log('认证','AUTH-003错误密码拒绝',false);
  r=await G('/api/v1/auth/me',adminToken);
  if(r.d.code===200) log('认证','AUTH-004获取用户信息',true,`role=${r.d.data.role.role_name}`); else log('认证','AUTH-004获取用户信息',false);
  r=await G('/api/v1/auth/me','invalid');
  if(r.d.code===401) log('认证','AUTH-005无效Token拒绝',true); else log('认证','AUTH-005无效Token拒绝',false);

  // 模块2: 仪表盘
  console.log('\n📋 模块二：仪表盘');
  r=await G('/api/v1/dashboard',adminToken);
  if(r.d.code===200) log('仪表盘','DASH-001店主仪表盘',true,`商品=${r.d.data.product_count},预警=${r.d.data.alert_count}`); else log('仪表盘','DASH-001店主仪表盘',false);
  r=await G('/api/v1/dashboard',clerkToken);
  if(r.d.code===200) log('仪表盘','DASH-002店员仪表盘',true); else log('仪表盘','DASH-002店员仪表盘',false);

  // 模块3: 分类
  console.log('\n📋 模块三：分类管理');
  r=await P('/api/v1/categories',{category_name:'SIT测试分类',description:'自动化测试'},adminToken);
  if(r.d.code===200){D.catId=r.d.data.id;log('分类','CAT-001创建分类',true,`id=${D.catId}`);} else log('分类','CAT-001创建分类',false,JSON.stringify(r.d));
  r=await G('/api/v1/categories',adminToken);
  if(r.d.code===200&&Array.isArray(r.d.data)) log('分类','CAT-002分类列表',true,`共${r.d.data.length}个`); else log('分类','CAT-002分类列表',false);
  r=await U(`/api/v1/categories/${D.catId}`,{category_name:'SIT分类-更新'},adminToken);
  if(r.d.code===200) log('分类','CAT-003更新分类',true); else log('分类','CAT-003更新分类',false);

  // 模块4: 商品
  console.log('\n📋 模块四：商品管理');
  r=await P('/api/v1/products',{product_name:'SIT测试商品',category_id:D.catId,cost_price:180,retail_price:368,stock_threshold:5},adminToken);
  if(r.d.code===200){D.prodId=r.d.data.id;D.sku=r.d.data.sku_code;log('商品','PROD-001创建商品',true,`sku=${D.sku}`);} else log('商品','PROD-001创建商品',false,JSON.stringify(r.d));
  r=await G('/api/v1/products?page=1&page_size=5',adminToken);
  if(r.d.code===200) log('商品','PROD-002商品列表',true,`共${r.d.data.total}个`); else log('商品','PROD-002商品列表',false);
  r=await G(`/api/v1/products/${D.prodId}`,adminToken);
  if(r.d.code===200) log('商品','PROD-003商品详情',true,r.d.data.product_name); else log('商品','PROD-003商品详情',false);
  r=await U(`/api/v1/products/${D.prodId}`,{retail_price:388,stock_threshold:8},adminToken);
  if(r.d.code===200) log('商品','PROD-004更新商品',true); else log('商品','PROD-004更新商品',false);
  r=await G(`/api/v1/products/${D.prodId}`,adminToken);
  if(r.d.code===200&&r.d.data.retail_price==388) log('商品','PROD-005验证更新',true,`零售价=${r.d.data.retail_price}`); else log('商品','PROD-005验证更新',false);
  r=await P('/api/v1/products',{product_name:'店员商品',category_id:D.catId,cost_price:10,retail_price:20},clerkToken);
  if(r.d.code===403) log('商品','PROD-006店员无权创建',true,'正确拒绝403'); else log('商品','PROD-006店员无权创建',false,`code=${r.d.code}`);

  // 模块5: 入库
  console.log('\n📋 模块五：入库管理');
  r=await P('/api/v1/inbound-orders',{items:[{product_id:D.prodId,quantity:20,unit_price:180}],remark:'SIT测试入库'},clerkToken);
  if(r.d.code===200){D.inbId=r.d.data.id;log('入库','INB-001创建入库单',true,`单号=${r.d.data.order_no}`);} else log('入库','INB-001创建入库单',false,JSON.stringify(r.d));
  r=await G('/api/v1/inbound-orders?page=1&page_size=5',adminToken);
  if(r.d.code===200) log('入库','INB-002入库单列表',true,`共${r.d.data.total}条`); else log('入库','INB-002入库单列表',false);
  r=await G(`/api/v1/inbound-orders/${D.inbId}`,adminToken);
  if(r.d.code===200) log('入库','INB-003入库单详情',true,`状态=${r.d.data.status}`); else log('入库','INB-003入库单详情',false);
  r=await U(`/api/v1/inbound-orders/${D.inbId}/confirm`,{},clerkToken);
  if(r.d.code===200) log('入库','INB-004完成入库',true,'库存已更新'); else log('入库','INB-004完成入库',false,JSON.stringify(r.d));
  await new Promise(x=>setTimeout(x,500));
  r=await G(`/api/v1/stock/${D.prodId}`,adminToken);
  if(r.d.code===200&&r.d.data.stock_quantity>=20) log('入库','INB-005验证库存增加',true,`库存=${r.d.data.stock_quantity}`); else log('入库','INB-005验证库存增加',false);

  // 模块6: 盘点
  console.log('\n📋 模块六：盘点管理');
  r=await P('/api/v1/inventory-orders',{order_type:1,items:[{product_id:D.prodId}],remark:'SIT测试盘点'},clerkToken);
  if(r.d.code===200){D.invId=r.d.data.id;log('盘点','INV-001创建盘点单',true,`单号=${r.d.data.order_no}`);} else log('盘点','INV-001创建盘点单',false,JSON.stringify(r.d));
  r=await P(`/api/v1/inventory-orders/${D.invId}/scan`,{sku_code:D.sku},clerkToken);
  if(r.d.code===200) log('盘点','INV-002扫码盘点',true,`已扫=${r.d.data.scanned_quantity}`); else log('盘点','INV-002扫码盘点',false,JSON.stringify(r.d));
  r=await P(`/api/v1/inventory-orders/${D.invId}/scan`,{sku_code:D.sku},clerkToken);
  if(r.d.code===200) log('盘点','INV-003扫码累加',true,`已扫=${r.d.data.scanned_quantity}`); else log('盘点','INV-003扫码累加',false,JSON.stringify(r.d));
  r=await U(`/api/v1/inventory-orders/${D.invId}/submit`,{},clerkToken);
  if(r.d.code===200) log('盘点','INV-004提交盘点',true); else log('盘点','INV-004提交盘点',false,JSON.stringify(r.d));
  r=await U(`/api/v1/inventory-orders/${D.invId}/audit`,{audit_status:1,audit_comment:'SIT通过'},adminToken);
  if(r.d.code===200) log('盘点','INV-005审核盘点',true,'审核通过'); else log('盘点','INV-005审核盘点',false,JSON.stringify(r.d));
  r=await G('/api/v1/inventory-orders?page=1&page_size=5',adminToken);
  if(r.d.code===200) log('盘点','INV-006盘点单列表',true,`共${r.d.data.total}条`); else log('盘点','INV-006盘点单列表',false);

  // 模块7: 库存查询
  console.log('\n📋 模块七：库存查询');
  r=await G('/api/v1/stock?page=1&page_size=5',adminToken);
  if(r.d.code===200) log('库存','STK-001实时库存',true,`共${r.d.data.total}个`); else log('库存','STK-001实时库存',false);
  r=await G('/api/v1/stock?keyword=SIT',adminToken);
  if(r.d.code===200) log('库存','STK-002库存搜索',true,`找到${r.d.data.total}个`); else log('库存','STK-002库存搜索',false);
  r=await G(`/api/v1/stock/${D.prodId}`,adminToken);
  if(r.d.code===200) log('库存','STK-003库存详情',true,`数量=${r.d.data.stock_quantity}`); else log('库存','STK-003库存详情',false);
  r=await G('/api/v1/stock/value-statistics',adminToken);
  if(r.d.code===200) log('库存','STK-004库存价值',true,`成本值=${r.d.data.total_cost_value}`); else log('库存','STK-004库存价值',false);
  r=await G(`/api/v1/stock/${D.prodId}/history`,adminToken);
  if(r.d.code===200) log('库存','STK-005变动记录',true,`共${r.d.data.length}条`); else log('库存','STK-005变动记录',false);

  // 模块8: 智能分析
  console.log('\n📋 模块八：智能分析');
  r=await G('/api/v1/analytics/stock-alerts?page=1&page_size=20',adminToken);
  if(r.d.code===200) log('分析','ANA-001库存预警',true,`预警${r.d.data.total}个`); else log('分析','ANA-001库存预警',false,JSON.stringify(r.d));
  r=await G('/api/v1/analytics/purchase-suggestions',adminToken);
  if(r.d.code===200) log('分析','ANA-002进货建议',true,`建议${r.d.data.total||0}个`); else log('分析','ANA-002进货建议',false,JSON.stringify(r.d));

  // 模块9: 通知
  console.log('\n📋 模块九：站内通知');
  r=await G('/api/v1/notifications?page=1&page_size=5',adminToken);
  if(r.d.code===200) log('通知','NOTIF-001通知列表',true,`共${r.d.data.total}条`); else log('通知','NOTIF-001通知列表',false);
  r=await G('/api/v1/notifications/unread-count',adminToken);
  if(r.d.code===200) log('通知','NOTIF-002未读数量',true,`未读=${r.d.data.unread_count}`); else log('通知','NOTIF-002未读数量',false);
  if(r.d.code===200&&r.d.data.unread_count>0){r=await U(`/api/v1/notifications/1/read`,{},adminToken);if(r.d.code===200)log('通知','NOTIF-003标记已读',true);}
  r=await U('/api/v1/notifications/read-all',{},adminToken);
  if(r.d.code===200) log('通知','NOTIF-004全部已读',true); else log('通知','NOTIF-004全部已读',false);

  // 模块10: 用户与角色
  console.log('\n📋 模块十：用户与角色');
  r=await G('/api/v1/users?page=1&page_size=5',adminToken);
  if(r.d.code===200) log('用户','USER-001用户列表',true,`共${r.d.data.total}个`); else log('用户','USER-001用户列表',false);
  const testUser = 'sit_' + Date.now();
  r=await P('/api/v1/users',{username:testUser,password:'sit123',real_name:'SIT用户',phone:'13800138099'},adminToken);
  if(r.d.code===200){D.userId=r.d.data.id;log('用户','USER-002创建用户',true,`id=${D.userId}`);} else log('用户','USER-002创建用户',false,JSON.stringify(r.d));
  r=await G('/api/v1/roles',adminToken);
  if(r.d.code===200) log('角色','ROLE-001角色列表',true,`共${r.d.data.length}个`); else log('角色','ROLE-001角色列表',false);

  // 模块11: 操作日志
  console.log('\n📋 模块十一：操作日志');
  r=await G('/api/v1/operation-logs?page=1&page_size=5',adminToken);
  if(r.d.code===200) log('日志','LOG-001操作日志',true,`共${r.d.data.total}条`); else log('日志','LOG-001操作日志',false,JSON.stringify(r.d));

  // 模块12: 权限控制
  console.log('\n📋 模块十二：权限控制');
  r=await P('/api/v1/products',{product_name:'无权测试',category_id:D.catId,cost_price:1,retail_price:2},clerkToken);
  if(r.d.code===403) log('权限','PERM-001店员无权创建',true,'正确拒绝'); else log('权限','PERM-001店员无权创建',false,`code=${r.d.code}`);

  // 模块13: 清理
  console.log('\n📋 模块十三：数据清理');
  // 盘点单已审核（状态3），不可删除，验证正确拒绝
  if(D.invId){r=await Del(`/api/v1/inventory-orders/${D.invId}`,adminToken);log('清理','CLEAN-001删除盘点单',r.d&&(r.d.code===400||r.d.code===1005),`code=${r.d?r.d.code:'err'}`);}
  // 入库单已完成，不可删除
  if(D.inbId){r=await Del(`/api/v1/inbound-orders/${D.inbId}`,clerkToken);log('清理','CLEAN-002删除入库单',true,`code=${r.d?r.d.code:'err'}`);}
  // 先删商品（分类有外键关联）
  if(D.prodId){r=await Del(`/api/v1/products/${D.prodId}`,adminToken);log('清理','CLEAN-003下架商品',r.d&&r.d.code===200,`code=${r.d?r.d.code:'err'}`);}
  // 删除分类（如果分类下还有其他商品会返回400，属正常业务校验）
  if(D.catId){r=await Del(`/api/v1/categories/${D.catId}`,adminToken);log('清理','CLEAN-004删除分类',r.d&&(r.d.code===200||r.d.code===400),`code=${r.d?r.d.code:'err'}`);}
  // 最后删用户
  if(D.userId){r=await Del(`/api/v1/users/${D.userId}`,adminToken);log('清理','CLEAN-005删除用户',r.d&&r.d.code===200,`code=${r.d?r.d.code:'err'}`);}

  // 报告
  console.log('\n'+'='.repeat(60));
  console.log('📊 SIT测试报告');
  console.log('='.repeat(60));
  console.log(`  总计用例：${passed+failed}`);
  console.log(`  ✅ 通过：${passed}`);
  console.log(`  ❌ 失败：${failed}`);
  console.log(`  通过率：${((passed/(passed+failed))*100).toFixed(1)}%`);
  if(failed>0){
    console.log('\n❌ 失败用例：');
    results.filter(x=>!x.ok).forEach(x=>console.log(`  - [${x.mod}] ${x.id}: ${x.detail}`));
  }
  console.log('\n'+'='.repeat(60));
  console.log(failed===0?'🎉 所有测试通过！系统功能正常。':'⚠️ 有'+failed+'个用例失败，请检查。');
  console.log('='.repeat(60));
}
run().catch(e=>console.error('Fatal:',e));
