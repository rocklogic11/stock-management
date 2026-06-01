const fs = require('fs');
const path = require('path');

let ossClient = null;
let useOss = false;

// 初始化 OSS 客户端
function initOss() {
  if (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET) {
    console.log('OSS 配置不完整，图片将存储在本地磁盘');
    return false;
  }
  try {
    const OSS = require('ali-oss');
    ossClient = new OSS({
      region: process.env.OSS_REGION || 'oss-cn-hangzhou',
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
      bucket: process.env.OSS_BUCKET || 'stock-management',
    });
    useOss = true;
    console.log('OSS 连接成功');
    return true;
  } catch (error) {
    console.error('OSS 初始化失败，降级为本地存储:', error.message);
    return false;
  }
}

// 初始化
initOss();

/**
 * 上传文件
 * @param {string} localFilePath - 本地文件路径
 * @param {string} ossPath - OSS 存储路径（如 products/xxx.jpg）
 * @returns {string} 文件访问 URL
 */
async function uploadFile(localFilePath, ossPath) {
  if (useOss && ossClient) {
    try {
      const result = await ossClient.put(ossPath, localFilePath);
      return result.url;
    } catch (error) {
      console.error('OSS 上传失败，降级为本地存储:', error.message);
    }
  }

  // 降级：本地存储，返回相对路径
  const fileName = path.basename(localFilePath);
  const destDir = path.join(__dirname, '../../uploads/products');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destPath = path.join(destDir, fileName);
  if (destPath !== localFilePath) {
    fs.copyFileSync(localFilePath, destPath);
  }
  return `/uploads/products/${fileName}`;
}

/**
 * 删除 OSS 文件
 * @param {string} fileUrl - 文件 URL 或相对路径
 */
async function deleteFile(fileUrl) {
  if (!fileUrl) return;

  if (useOss && ossClient && fileUrl.startsWith('http')) {
    try {
      // 从 URL 中提取 OSS 路径
      const urlObj = new URL(fileUrl);
      const ossPath = urlObj.pathname.slice(1);
      await ossClient.delete(ossPath);
      return;
    } catch (error) {
      console.error('OSS 删除失败:', error.message);
    }
  }

  // 本地文件删除
  if (fileUrl.startsWith('/uploads/')) {
    const localPath = path.join(__dirname, '../..', fileUrl);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
}

/**
 * 生成 OSS 路径
 * @param {string} prefix - 前缀（如 products）
 * @param {string} fileName - 文件名
 * @returns {string} OSS 路径
 */
function getOssPath(prefix, fileName) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${fileName}`;
  return `${prefix}/${dateStr}/${uniqueName}`;
}

module.exports = { uploadFile, deleteFile, getOssPath, useOss };
