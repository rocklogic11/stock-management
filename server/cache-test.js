const http = require('http');

// 简易HTTP客户端
function request(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const url = new URL(`http://localhost:3000/api/v1${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    };
    
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// 登录获取token
async function login(username, password) {
  const res = await request('POST', '/auth/login', null, { username, password });
  return res.data.data.token;
}

// 测试缓存效果
async function testCacheEffect() {
  console.log('🚀 缓存性能测试\n');
  console.log('='.repeat(60));
  
  const token = await login('admin', 'admin123');
  console.log('✅ 登录成功\n');
  
  // 测试1: 商品列表缓存
  console.log('📦 测试1: 商品列表缓存效果');
  console.log('-'.repeat(60));
  
  // 第一次请求（缓存未命中）
  const start1 = Date.now();
  await request('GET', '/products?page=1&page_size=20', token);
  const time1 = Date.now() - start1;
  console.log(`  第1次请求 (缓存未命中): ${time1}ms`);
  
  // 第二次请求（缓存命中）
  const start2 = Date.now();
  await request('GET', '/products?page=1&page_size=20', token);
  const time2 = Date.now() - start2;
  console.log(`  第2次请求 (缓存命中): ${time2}ms`);
  console.log(`  ⚡ 性能提升: ${Math.round((time1 - time2) / time1 * 100)}%`);
  console.log('');
  
  // 测试2: 分类列表缓存
  console.log('📁 测试2: 分类列表缓存效果');
  console.log('-'.repeat(60));
  
  const start3 = Date.now();
  await request('GET', '/categories', token);
  const time3 = Date.now() - start3;
  console.log(`  第1次请求 (缓存未命中): ${time3}ms`);
  
  const start4 = Date.now();
  await request('GET', '/categories', token);
  const time4 = Date.now() - start4;
  console.log(`  第2次请求 (缓存命中): ${time4}ms`);
  console.log(`  ⚡ 性能提升: ${Math.round((time3 - time4) / time3 * 100)}%`);
  console.log('');
  
  // 测试3: 并发读取（有缓存）
  console.log('🔥 测试3: 并发读取性能 (有缓存)');
  console.log('-'.repeat(60));
  
  const concurrentUsers = [10, 50, 100];
  
  for (const users of concurrentUsers) {
    // 预热缓存
    await request('GET', '/products?page=1&page_size=20', token);
    
    const start = Date.now();
    const promises = [];
    
    for (let i = 0; i < users; i++) {
      promises.push(
        request('GET', '/products?page=1&page_size=20', token)
      );
    }
    
    const results = await Promise.all(promises);
    const duration = Date.now() - start;
    const qps = Math.round(users / duration * 1000);
    const avgTime = Math.round(duration / users);
    
    const successCount = results.filter(r => r.status === 200).length;
    
    console.log(`  ${users}并发: ${duration}ms, QPS=${qps}, 平均=${avgTime}ms, 成功=${successCount}/${users}`);
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('✅ 缓存性能测试完成');
  console.log('');
  console.log('📊 对比 (无缓存 vs 有缓存)');
  console.log('-'.repeat(60));
  console.log('无缓存: QPS ≈ 110');
  console.log('有缓存: QPS ≈ 预估 300-500 (提升3-5倍)');
}

testCacheEffect().catch(console.error);
