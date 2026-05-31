const http = require('http');

function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const b = body ? JSON.stringify(body) : null;
    const h = { 'Content-Type': 'application/json' };
    if (b) h['Content-Length'] = Buffer.byteLength(b);
    if (token) h['Authorization'] = `Bearer ${token}`;
    
    const fullUrl = 'http://localhost:3000/api/v1' + path;
    const url = new URL(fullUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: h
    };
    
    const r = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, d: JSON.parse(d) }); } 
        catch(e) { resolve({ s: res.statusCode, d }); }
      });
    });
    r.on('error', reject);
    if (b) r.write(b);
    r.end();
  });
}

async function test() {
  // 登录
  const login = await req('POST', '/auth/login', null, { username: 'admin', password: 'admin123' });
  const token = login.d.data.token;
  console.log('✅ 登录成功');
  
  // 尝试批量创建5个商品
  console.log('\n开始批量创建5个商品...');
  const promises = [];
  const timestamp = Date.now();
  
  for (let i = 0; i < 5; i++) {
    promises.push(
      req('POST', '/products', token, {
        product_name: `测试商品${timestamp}_${i}`,
        category_id: 1,
        cost_price: 10,
        retail_price: 20,
        stock_quantity: 100
      }).then(r => ({ i, status: r.s, body: r.d }))
    );
  }
  
  const results = await Promise.all(promises);
  console.log('\n结果:');
  results.forEach(r => {
    console.log(`  商品${r.i}: status=${r.status}, code=${r.body?.code}, msg=${r.body?.message}`);
  });
}

test().catch(e => console.error('错误:', e));
