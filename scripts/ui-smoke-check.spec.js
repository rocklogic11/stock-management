const path = require('path');
const { test, expect } = require('@playwright/test');

const BASE_URL = (process.env.UI_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const USERNAME = process.env.UI_ADMIN_USER || 'admin';
const PASSWORD = process.env.UI_ADMIN_PASSWORD || 'admin123';
const ARTIFACT_DIR = path.resolve(__dirname, '../docs/release/2026-06-01/artifacts');

test.use({ channel: 'chrome' });
test.setTimeout(60000);

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  if (await page.getByPlaceholder('请输入用户名').count()) {
    await page.getByPlaceholder('请输入用户名').fill(USERNAME);
    await page.getByPlaceholder('请输入密码').fill(PASSWORD);
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForURL(/\/dashboard|\/products|\/$/, { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('networkidle');
  }
}

async function expectNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
    };
  });
  const maxOverflow = Math.max(overflow.scrollWidth - overflow.clientWidth, overflow.bodyScrollWidth - overflow.bodyClientWidth);
  expect(maxOverflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(4);
}

for (const scenario of [
  { name: 'pc', viewport: { width: 1365, height: 768 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
]) {
  test(`${scenario.name} product category dropdown`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: scenario.viewport });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/products`, { waitUntil: 'networkidle' });
    await expect(page.locator('header').getByText('商品档案')).toBeVisible();
    await expect(page.getByText('网络错误')).toHaveCount(0);
    await expectNoHorizontalOverflow(page, `${scenario.name} products`);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, `${scenario.name}-products.png`), fullPage: true });

    await page.getByText('新增商品').first().click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    await dialog.screenshot({ path: path.join(ARTIFACT_DIR, `${scenario.name}-product-dialog.png`) });

    await dialog.locator('.el-select').first().click();
    await expect.poll(async () => page.locator('.el-select-dropdown__item').count(), {
      message: `${scenario.name}: category dropdown option count`,
      timeout: 10000,
    }).toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page, `${scenario.name} product dialog`);

    await context.close();
  });
}
