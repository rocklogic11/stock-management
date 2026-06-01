# 2026-05-31 实施日志：手机扫码与商品图片闭环

## 目标

本轮按优先级修复“新增/编辑商品时手机端扫码填充商品编号、上传最多 4 张商品照片、PC 与手机端同等可用”的问题。

## P0 清单

1. 数据库与迁移闭环：`barcode`、`images`、库存流水表在 SQLite/MySQL 环境都有可执行迁移。
2. 后端数据校验：商品编号唯一、图片最多 4 张、图片 URL 来源受控。
3. 图片生命周期：删除图片时同步删除文件；取消新增/编辑时清理本次未保存上传。
4. 手机扫码：支持实时摄像头扫码，并保留拍照识别和手动输入兜底。
5. 双端展示：PC 保持表格效率，手机端提供卡片列表、全屏商品表单和底部固定操作。
6. 自测：后端语法检查、前端构建、关键静态检查。

## 变更记录

- 后端：
  - `Product.barcode` 增加唯一约束定义。
  - `POST /products`、`PUT /products/:id` 增加商品编号重复校验、图片数量和图片来源校验。
  - `POST /upload/product-image/delete` 增加商品图片删除接口。
  - 入库/盘点扫码接口支持按系统 SKU 或商品包装 `barcode` 匹配。
  - `migrate-add-barcode-images.js` 改为兼容 SQLite/MySQL 的迁移脚本，并补 `stock_movement` 表创建。
  - `建表SQL_库存预备齐库存管理系统.sql`、数据库设计文档、API 文档同步新增字段和接口。
- 前端：
  - `BarcodeScanner.vue` 增加实时摄像头扫码，保留拍照识别和手动输入。
  - 扫码识别库改为动态加载，避免商品页初始包过大。
  - `ProductImages.vue` 增加上传/删除事件，移动端改为 2x2 图片宫格。
  - `Products.vue` 增加手机端卡片列表、全屏商品表单、底部固定提交操作。
  - 新增/编辑弹窗取消时清理本次未保存上传图片；保存后清理已移除的旧图片。

## 自测记录

- `npm run migrate:barcode-images`：通过。
- `node --check server/src/**/*.js`：通过。
- `npm run build`（web）：通过。
- 临时后端 `PORT=3100` 接口自测：通过。
  - 管理员登录成功。
  - 创建带 `barcode` 和 4 张图片的商品成功。
  - 重复 `barcode` 创建被 400 拦截。
  - 5 张图片创建被 400 拦截。
  - 图片删除接口返回 200。

## 待人工验证

- 手机 HTTPS 环境下实时摄像头扫码权限与识别率。
- iOS Safari、Android Chrome 分别测试条形码和二维码。
- 手机端新增/编辑商品表单滚动、底部按钮、图片预览体验。
- PC 端商品表格、二维码、图片预览是否保持原操作效率。

## 2026-06-01 追加修复

- 修复刷新后 `userStore.permissions` 未从本地用户信息恢复，导致 PC 端商品档案“新增商品”按钮可能被权限判断误隐藏。
- 商品档案头部改为明确的双端布局：PC 端搜索区和新增按钮并排，手机端纵向排列。
- 拍照识别优化为优先使用 `html5-qrcode.scanFile`，再依次兜底 `BarcodeDetector`、`Quagga2`、`jsQR`。
- 拍照识别增加高分辨率画布和灰度增强画布两轮识别，提高弱光、低对比度图片的成功率。
- 实时扫码取景框从方形改为更适合商品条形码的横向框，摄像头约束改为优先后置摄像头。

### 追加自测

- `npm run build`（web）：通过。
- Playwright PC 视口验证：商品档案“新增商品”按钮可见，PC 表格可见。
- Playwright 手机视口验证：商品档案“新增商品”按钮可见，新增弹窗中“实时扫码”“拍照识别”按钮可见。
- 手机局域网 HTTP 地址下点击“实时扫码”：正确提示需要 HTTPS。
- 使用临时二维码图片 `TEST-SCAN-20260601` 验证“拍照识别”：成功回填商品编号。

## 2026-06-01 iOS 实测问题修复

- 问题：iPhone Safari/无痕浏览中点击实时扫码后，`html5-qrcode` 预览区域黑屏。
- 修复：实时扫码改为自控 `video` 预览，显式设置 `autoplay/muted/playsinline/webkit-playsinline`，通过 `getUserMedia` 获取后置摄像头并逐帧识别。
- 问题：拍照识别在部分照片上长期停留“正在识别码...”。
- 修复：为 `html5-qrcode.scanFile`、`BarcodeDetector`、`Quagga2`、`jsQR` 增加超时保护，任何识别器卡住都会自动进入下一兜底或给出失败提示。
- 追加自测：`npm run build` 通过；临时二维码图片 `TEST-SCAN-IOS-FIX` 拍照识别成功回填，加载状态正常结束。

## 2026-06-01 ZXing 方案替换

- 调研结论：移动 Web 上更稳的结构是原生 `getUserMedia + video playsinline` 控制摄像头预览，使用 ZXing 多格式识别作为主识别器；`html5-qrcode` 保留为图片识别兜底，不再负责实时摄像头预览。
- 实时扫码：改为 `@zxing/library` 的 `BrowserMultiFormatReader.decodeFromConstraints`，支持 QR、EAN-13、EAN-8、Code128、Code39、UPC-A、UPC-E、ITF、DataMatrix。
- 图片识别：优先使用 ZXing 从 canvas 解码，增加原图、增强图、旋转图、旋转增强图四组输入，再保留 `html5-qrcode`、`BarcodeDetector`、`Quagga2`、`jsQR` 兜底。
- 自测：`npm run build` 通过；临时二维码图片 `TEST-ZXING-PRIMARY` 成功识别并回填；Cloudflare HTTPS 健康接口返回 200。

### 最终扫码方案说明

- iOS Safari 必须通过 HTTPS 访问；本地 HTTP 仅用于普通表单/列表测试，不能用于实时摄像头扫码。
- 测试通道使用 Cloudflare Quick Tunnel，最终稳定方式为隧道转发到后端生产入口 `http://127.0.0.1:3000`，避免转发到 Vite dev server 导致加载慢和 HTTP/2 stream closed。
- PC 端测试地址：`http://localhost:3000/`；手机普通功能测试：`http://192.168.0.102:3000/`；手机实时扫码测试：Cloudflare 生成的 `https://*.trycloudflare.com/`。
- 实时扫码主链路：`getUserMedia` 获取后置摄像头，`video` 显式设置 `autoplay/muted/playsinline/webkit-playsinline`，ZXing `BrowserMultiFormatReader.decodeFromConstraints` 连续识别。
- 图片识别主链路：将照片加载为 canvas，ZXing 依次识别原图、灰度增强图、旋转图、旋转增强图；失败后进入 `html5-qrcode`、`BarcodeDetector`、`Quagga2`、`jsQR` 兜底。
- 识别器全部设置超时，避免拍照识别长期停留在“正在识别码...”。
- 人工实测结果：iPhone Safari HTTPS 实时扫码已成功。

## 2026-06-01 分类下拉修复

- 问题：新增商品弹窗中商品分类下拉为空，导致商品无法保存。
- 原因：`categories.js` 中 `CacheUtil.get()` 是异步函数，但调用时缺少 `await`，后端将 Promise 当作缓存命中返回，JSON 序列化后变成 `{}`。
- 修复：`GET /api/v1/categories` 增加 `await CacheUtil.get(...)` 和 `await CacheUtil.set(...)`，分类查询增加 `raw: true`，确保接口返回普通数组。
- 自测：管理员登录后调用 `/api/v1/categories` 返回 6 个分类。

## 2026-06-01 闭环复核

- 新增 `docs/PROJECT_REVIEW_CLOSURE_2026-06-01.md`，汇总近两天评审建议的完成状态、自测结果和后续非阻塞优化项。
- 商品新增页分类下拉增加前端防御：非数组响应不再写入下拉；打开新增/编辑弹窗时若分类为空会主动补拉；分类为空时阻止保存并提示。
- 库存查询、盘点建单分类下拉增加非数组响应防御。
- 自测：`npm run build` 通过；`npm run migrate:barcode-images` 通过；分类接口返回 6 个分类；使用分类新增商品成功并删除自测商品。
