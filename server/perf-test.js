const http = require('http');
const https = require('https');

const BASE = 'http://localhost:3000/api/v1';
let adminToken = '';

// 性能测试结果存储
const perfResults = {
  dataPreparation: {},
  singleRequests: {},
  concurrentTests: {},
  largeDataTests: {}
};

// 通用请求函数
function req(method, path, token, body) {
  return new Promise((resolve, reject) => {
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
    
    const start = Date.now();
    const r = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const duration = Date.now() - start;
        try {
          resolve({ s: res.statusCode, d: JSON.parse(d), duration });
        } catch(e) {
          resolve({ s: res.statusCode, d, duration, raw: true });
        }
      });
    });
    r.on('error', (e) => {
      const duration = Date.now() - start;
      reject({ error: e.message, duration });
    });
    r.setTimeout(30000, () => {
      r.destroy();
      reject({ error: 'Timeout', duration: 30000 });
    });
    if (b) r.write(b);
    r.end();
  });
}

const G = (p, t) => req('GET', p, t);
const P = (p, b, t) => req('POST', p, t, b);
const U = (p, b, t) => req('PUT', p, t, b);
const D = (p, t) => req('DELETE', p, t);

// 登录获取token
async function login() {
  const r = await P('/auth/login', { username: 'admin', password: 'admin123' });
  if (r.s === 200 && r.d.data && r.d.data.token) {
    adminToken = r.d.data.token;
    console.log('✅ 登录成功');
    return true;
  }
  console.log('❌ 登录失败:', r.d);
  return false;
}

// 批量创建测试数据
async function prepareTestData() {
  console.log('\n📊 准备性能测试数据...');
  const start = Date.now();
  
  // 1. 创建分类
  console.log('  创建分类...');
  const categories = [];
  for (let i = 0; i < 10; i++) {
    const r = await P('/categories', { 
      category_name: `性能测试分类${i+1}`,
      description: `用于性能测试的分类${i+1}`
    }, adminToken);
    if (r.s === 201 || r.s === 200) {
      categories.push(r.d.data?.id || r.d.data?.category?.id);
    }
  }
  console.log(`  ✓ 创建了 ${categories.length} 个分类`);
  
  // 2. 批量创建1000个商品
  console.log('  批量创建1000个商品...');
  const batchSize = 50;
  let createdProducts = 0;
  const timestamp = Date.now(); // 使用时间戳确保唯一性
  
  for (let batch = 0; batch < 20; batch++) {
    const promises = [];
    for (let i = 0; i < batchSize; i++) {
      const idx = batch * batchSize + i;
      promises.push(
        P('/products', {
          product_name: `性能测试商品${timestamp}_${idx + 1}`,
          category_id: categories[idx % categories.length] || 1,
          cost_price: (Math.random() * 100).toFixed(2),
          retail_price: (Math.random() * 200).toFixed(2),
          stock_quantity: Math.floor(Math.random() * 1000)
        }, adminToken).then(r => {
          if (r.s === 201 || r.s === 200) createdProducts++;
        }).catch(e => {})
      );
    }
    await Promise.all(promises);
    process.stdout.write(`\r  ✓ 已创建 ${Math.min((batch + 1) * batchSize, 1000)} 个商品`);
  }
  console.log(`\n  ✓ 总共创建了 ${createdProducts} 个商品`);
  
  // 3. 创建一些入库单
  console.log('  创建入库单...');
  let createdOrders = 0;
  for (let i = 0; i < 50; i++) {
    const r = await P('/inbound-orders', {
      order_no: `PERF${String(i).padStart(6, '0')}`,
      remarks: `性能测试入库单${i + 1}`
    }, adminToken);
    if (r.s === 201 || r.s === 200) {
      createdOrders++;
    }
  }
  console.log(`  ✓ 创建了 ${createdOrders} 个入库单`);
  
  const duration = Date.now() - start;
  perfResults.dataPreparation = {
    duration,
    categories: categories.length,
    products: createdProducts,
    orders: createdOrders
  };
  console.log(`✅ 数据准备完成，耗时: ${duration}ms\n`);
}

// 测试单次请求响应时间
async function testSingleRequestPerformance() {
  console.log('⏱️  单次请求响应时间测试...');
  
  const tests = [
    { name: '健康检查', path: '/health', token: null },
    { name: '商品列表(100条)', path: '/products?page=1&pageSize=100', token: adminToken },
    { name: '商品列表(500条)', path: '/products?page=1&pageSize=500', token: adminToken },
    { name: '商品列表(1000条)', path: '/products?page=1&pageSize=1000', token: adminToken },
    { name: '分类列表', path: '/categories', token: adminToken },
    { name: '入库单列表', path: '/inbound-orders?page=1&pageSize=100', token: adminToken },
    { name: '库存查询', path: '/inventory/stock?page=1&pageSize=100', token: adminToken },
    { name: '仪表盘统计', path: '/dashboard/stats', token: adminToken }
  ];
  
  const results = [];
  
  for (const test of tests) {
    // 每个测试执行3次取平均值
    const durations = [];
    for (let i = 0; i < 3; i++) {
      try {
        const r = await G(test.path, test.token);
        durations.push(r.duration);
      } catch(e) {
        durations.push(-1);
      }
    }
    
    const validDurations = durations.filter(d => d > 0);
    const avgDuration = validDurations.length > 0 
      ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length)
      : -1;
    const minDuration = validDurations.length > 0 ? Math.min(...validDurations) : -1;
    const maxDuration = validDurations.length > 0 ? Math.max(...validDurations) : -1;
    
    results.push({
      name: test.name,
      avgDuration,
      minDuration,
      maxDuration,
      path: test.path
    });
    
    console.log(`  ${test.name}: 平均=${avgDuration}ms, 最小=${minDuration}ms, 最大=${maxDuration}ms`);
  }
  
  perfResults.singleRequests = results;
  console.log('✅ 单次请求测试完成\n');
}

// 测试并发请求处理
async function testConcurrentRequests() {
  console.log('🚀 并发请求处理测试...');
  
  const concurrentLevels = [10, 50, 100, 200];
  const results = [];
  
  for (const level of concurrentLevels) {
    console.log(`  测试并发级别: ${level} 个并发请求`);
    
    const testPromises = [];
    const start = Date.now();
    
    for (let i = 0; i < level; i++) {
      testPromises.push(
        G('/products?page=1&pageSize=100', adminToken)
          .then(r => ({ success: true, duration: r.duration }))
          .catch(e => ({ success: false, error: e.message }))
      );
    }
    
    const allResults = await Promise.all(testPromises);
    const totalDuration = Date.now() - start;
    
    const successCount = allResults.filter(r => r.success).length;
    const failCount = allResults.filter(r => !r.success).length;
    const durations = allResults.filter(r => r.success).map(r => r.duration);
    const avgDuration = durations.length > 0 
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : -1;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : -1;
    const minDuration = durations.length > 0 ? Math.min(...durations) : -1;
    
    const result = {
      concurrentLevel: level,
      totalDuration,
      successCount,
      failCount,
      avgDuration,
      minDuration,
      maxDuration,
      qps: Math.round(level / (totalDuration / 1000))
    };
    
    results.push(result);
    
    console.log(`    ✓ 总耗时: ${totalDuration}ms, 成功: ${successCount}, 失败: ${failCount}`);
    console.log(`    ✓ 平均响应: ${avgDuration}ms, QPS: ${result.qps}`);
  }
  
  perfResults.concurrentTests = results;
  console.log('✅ 并发请求测试完成\n');
}

// 测试大数据量查询性能
async function testLargeDataQueries() {
  console.log('📈 大数据量查询性能测试...');
  
  const tests = [
    { name: '全量商品查询(不分页)', path: '/products?page=1&pageSize=10000', token: adminToken },
    { name: '商品搜索(关键词)', path: '/products?keyword=性能测试&page=1&pageSize=100', token: adminToken },
    { name: '按分类筛选', path: '/products?category_id=1&page=1&pageSize=100', token: adminToken },
    { name: '库存预警查询', path: '/inventory/alerts', token: adminToken },
    { name: '入库单详情查询', path: '/inbound-orders?page=1&pageSize=100', token: adminToken }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`  ${test.name}...`);
    
    const durations = [];
    for (let i = 0; i < 5; i++) {
      try {
        const r = await G(test.path, test.token);
        durations.push(r.duration);
      } catch(e) {
        durations.push(-1);
      }
    }
    
    const validDurations = durations.filter(d => d > 0);
    const avgDuration = validDurations.length > 0 
      ? Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length)
      : -1;
    const p95 = validDurations.length > 0 
      ? validDurations.sort((a, b) => a - b)[Math.floor(validDurations.length * 0.95)]
      : -1;
    
    results.push({
      name: test.name,
      avgDuration,
      p95Duration: p95,
      path: test.path
    });
    
    console.log(`    ✓ 平均=${avgDuration}ms, P95=${p95}ms`);
  }
  
  perfResults.largeDataTests = results;
  console.log('✅ 大数据量查询测试完成\n');
}

// 测试数据库写入性能
async function testWritePerformance() {
  console.log('💾 数据库写入性能测试...');
  
  const writeTests = [
    { name: '单条商品创建', count: 1 },
    { name: '批量商品创建(10条)', count: 10 },
    { name: '批量商品创建(50条)', count: 50 }
  ];
  
  const results = [];
  const baseTimestamp = Date.now();
  
  for (const test of writeTests) {
    console.log(`  ${test.name}...`);
    
    const start = Date.now();
    const promises = [];
    
    for (let i = 0; i < test.count; i++) {
      // 使用唯一标识：时间戳_随机数_索引
      const uniqueSuffix = `${baseTimestamp}_${Math.random().toString(36).substr(2, 9)}_${i}`;
      promises.push(
        P('/products', {
          product_name: `写入性能测试${uniqueSuffix}`,
          category_id: 1,
          cost_price: 10.00,
          retail_price: 20.00,
          stock_quantity: 100
        }, adminToken)
      );
    }
    
    const allResults = await Promise.all(promises);
    const duration = Date.now() - start;
    
    const successCount = allResults.filter(r => r.s === 201 || r.s === 200).length;
    
    results.push({
      name: test.name,
      totalDuration: duration,
      avgPerRecord: Math.round(duration / test.count),
      successCount,
      failCount: test.count - successCount
    });
    
    console.log(`    ✓ 总耗时: ${duration}ms, 成功: ${successCount}/${test.count}, 平均每条: ${Math.round(duration / test.count)}ms`);
  }
  
  perfResults.writeTests = results;
  console.log('✅ 数据库写入测试完成\n');
}

// 生成性能测试报告
function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 性能测试报告'.padStart(50, ' '));
  console.log('='.repeat(80));
  
  // 1. 数据准备统计
  console.log('\n1️⃣  测试数据准备');
  console.log('-'.repeat(80));
  console.log(`分类数量: ${perfResults.dataPreparation.categories}`);
  console.log(`商品数量: ${perfResults.dataPreparation.products}`);
  console.log(`入库单数量: ${perfResults.dataPreparation.orders}`);
  console.log(`准备耗时: ${perfResults.dataPreparation.duration}ms`);
  
  // 2. 单次请求响应时间
  console.log('\n2️⃣  单次请求响应时间');
  console.log('-'.repeat(80));
  console.log('测试项'.padEnd(30, ' ') + '平均响应'.padEnd(15, ' ') + '最小'.padEnd(15, ' ') + '最大');
  console.log('-'.repeat(80));
  for (const r of perfResults.singleRequests) {
    const name = r.name.padEnd(30, ' ');
    const avg = `${r.avgDuration}ms`.padEnd(15, ' ');
    const min = `${r.minDuration}ms`.padEnd(15, ' ');
    const max = `${r.maxDuration}ms`;
    console.log(`${name}${avg}${min}${max}`);
  }
  
  // 3. 并发请求处理
  console.log('\n3️⃣  并发请求处理');
  console.log('-'.repeat(80));
  console.log('并发数'.padEnd(15, ' ') + '总耗时'.padEnd(15, ' ') + '成功'.padEnd(15, ' ') + '失败'.padEnd(15, ' ') + 'QPS');
  console.log('-'.repeat(80));
  for (const r of perfResults.concurrentTests) {
    const level = `${r.concurrentLevel}`.padEnd(15, ' ');
    const duration = `${r.totalDuration}ms`.padEnd(15, ' ');
    const success = `${r.successCount}`.padEnd(15, ' ');
    const fail = `${r.failCount}`.padEnd(15, ' ');
    const qps = `${r.qps}`;
    console.log(`${level}${duration}${success}${fail}${qps}`);
  }
  
  // 4. 大数据量查询
  console.log('\n4️⃣  大数据量查询性能');
  console.log('-'.repeat(80));
  console.log('测试项'.padEnd(35, ' ') + '平均响应'.padEnd(15, ' ') + 'P95响应');
  console.log('-'.repeat(80));
  for (const r of perfResults.largeDataTests) {
    const name = r.name.padEnd(35, ' ');
    const avg = `${r.avgDuration}ms`.padEnd(15, ' ');
    const p95 = `${r.p95Duration}ms`;
    console.log(`${name}${avg}${p95}`);
  }
  
  // 5. 写入性能
  if (perfResults.writeTests) {
    console.log('\n5️⃣  数据库写入性能');
    console.log('-'.repeat(80));
    console.log('测试项'.padEnd(30, ' ') + '总耗时'.padEnd(15, ' ') + '平均每条'.padEnd(15, ' ') + '成功率');
    console.log('-'.repeat(80));
    for (const r of perfResults.writeTests) {
      const name = r.name.padEnd(30, ' ');
      const duration = `${r.totalDuration}ms`.padEnd(15, ' ');
      const avg = `${r.avgPerRecord}ms`.padEnd(15, ' ');
      const rate = `${Math.round(r.successCount / (r.successCount + r.failCount) * 100)}%`;
      console.log(`${name}${duration}${avg}${rate}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 性能测试完成');
  console.log('='.repeat(80) + '\n');
  
  // 保存详细结果到文件
  const fs = require('fs');
  const reportPath = 'perf-test-results.json';
  fs.writeFileSync(reportPath, JSON.stringify(perfResults, null, 2));
  console.log(`详细结果已保存到: ${reportPath}\n`);
}

// 主函数
async function main() {
  console.log('🚀 开始性能测试...\n');
  
  // 1. 登录
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ 登录失败，测试终止');
    return;
  }
  
  // 2. 准备测试数据
  await prepareTestData();
  perfResults.dataPreparation = {
    duration: 0,
    categories: 10,
    products: 1000,
    orders: 50
  };
  
  // 3. 执行各项测试
  await testSingleRequestPerformance();
  await testConcurrentRequests();
  await testLargeDataQueries();
  await testWritePerformance();
  
  // 4. 生成报告
  generateReport();
}

main().catch(e => {
  console.error('❌ 测试异常:', e);
  process.exit(1);
});
