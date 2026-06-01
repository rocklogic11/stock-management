const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { auth, checkPermission } = require('../middleware/auth');
const { uploadFile, deleteFile, getOssPath } = require('../utils/oss');
const { success, fail } = require('../utils/helpers');

const router = express.Router();

// 确保临时上传目录存在
const tmpDir = path.join(__dirname, '../../uploads/tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

// multer 配置 - 先存临时文件
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, tmpDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/WebP 格式'));
    }
  },
});

// POST /api/v1/upload/product-images
router.post('/product-images', auth, checkPermission('product_manage'), upload.array('images', 4), async (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json(fail(400, '请选择要上传的图片'));
  }

  const imageUrls = [];
  const tmpFiles = [];

  try {
    for (const file of files) {
      tmpFiles.push(file.path);

      // 使用 sharp 压缩图片：最大宽度 800px，质量 80%
      const compressedPath = file.path.replace(path.extname(file.path), '_compressed.jpg');
      await sharp(file.path)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(compressedPath);

      tmpFiles.push(compressedPath);

      // 上传到 OSS 或本地
      const fileName = path.basename(compressedPath);
      const ossPath = getOssPath('products', fileName);
      const url = await uploadFile(compressedPath, ossPath);
      imageUrls.push(url);
    }

    res.json(success({ images: imageUrls }, '上传成功'));
  } catch (error) {
    console.error('图片上传失败:', error);
    res.status(500).json(fail(500, '图片上传失败'));
  } finally {
    // 清理临时文件
    for (const f of tmpFiles) {
      try { fs.unlinkSync(f); } catch (e) { /* ignore */ }
    }
  }
});

// POST /api/v1/upload/product-image/delete
router.post('/product-image/delete', auth, checkPermission('product_manage'), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json(fail(400, '图片地址不能为空'));
    }
    if (!isManagedProductImage(url)) {
      return res.status(400).json(fail(400, '图片地址来源不合法'));
    }

    await deleteFile(url);
    res.json(success(null, '删除成功'));
  } catch (error) {
    console.error('图片删除失败:', error);
    res.status(500).json(fail(500, '图片删除失败'));
  }
});

function isManagedProductImage(url) {
  if (url.startsWith('/uploads/products/')) return true;
  const ossBucket = process.env.OSS_BUCKET;
  if (!ossBucket) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes(`${ossBucket}.`) || parsed.pathname.startsWith('/products/');
  } catch (e) {
    return false;
  }
}

// multer 错误处理
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(fail(400, '图片大小不能超过5MB'));
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json(fail(400, '最多上传4张图片'));
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json(fail(400, '最多上传4张图片'));
  }
  if (err.message) {
    return res.status(400).json(fail(400, err.message));
  }
  next(err);
});

module.exports = router;
