const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: 'localhost', port: 3000, path }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ res, data: d }));
    });
    req.on('error', reject);
  });
}

async function main() {
  try {
    // 1. 获取 HTML
    console.log('=== 1. 获取 HTML ===');
    const { res: htmlRes, data: html } = await get('/');
    console.log('HTML Status:', htmlRes.statusCode);
    console.log('HTML Length:', html.length);

    // 2. 获取 JS
    console.log('\n=== 2. 获取主 JS ===');
    const jsMatch = html.match(/src="([^"]+\.js)"/);
    if (jsMatch) {
      const jsPath = jsMatch[1];
      console.log('JS Path:', jsPath);
      const { res: jsRes, data: js } = await get(jsPath);
      console.log('JS Status:', jsRes.statusCode);
      console.log('JS Length:', js.length);
      // 检查 JS 语法
      try {
        new Function(js);
        console.log('JS 语法: OK');
      } catch (e) {
        console.log('JS 语法错误:', e.message);
        console.log('前500字符:', js.substring(0, 500));
      }
    }

    // 3. 获取 CSS
    console.log('\n=== 3. 获取 CSS ===');
    const cssMatch = html.match(/href="([^"]+\.css)"/);
    if (cssMatch) {
      const cssPath = cssMatch[1];
      console.log('CSS Path:', cssPath);
      const { res: cssRes, data: css } = await get(cssPath);
      console.log('CSS Status:', cssRes.statusCode);
      console.log('CSS Length:', css.length);
    }

    // 4. 测试登录 API
    console.log('\n=== 4. 测试登录 API ===');
    const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };
    const loginReq = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log('Login Status:', res.statusCode);
        console.log('Login Response:', d.substring(0, 200));
        console.log('\n=== 全部检查完成 ===');
      });
    });
    loginReq.on('error', e => console.log('Login Error:', e.message));
    loginReq.write(loginData);
    loginReq.end();

  } catch (e) {
    console.log('Error:', e.message);
  }
}

main();
