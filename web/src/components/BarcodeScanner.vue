<template>
  <div class="barcode-scanner">
    <div class="scanner-input-row">
      <el-input
        v-model="barcode"
        placeholder="扫描或手动输入商品编号"
        clearable
        @input="onInput"
      >
        <template #prepend>商品编号</template>
      </el-input>
      <el-button type="primary" @click="startLiveScan" class="scan-btn" :loading="liveScanning">
        <el-icon v-if="!liveScanning"><Camera /></el-icon>
        实时扫码
      </el-button>
      <el-button @click="triggerPhotoScan" class="scan-btn" :loading="scanning">
        <el-icon v-if="!scanning"><Picture /></el-icon>
        拍照识别
      </el-button>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      style="display: none"
      @change="onFileSelected"
    />
    <div :id="fileScannerId" class="file-scanner-host"></div>
    <div v-if="scanning" class="scanning-hint">
      <el-icon class="is-loading"><Loading /></el-icon>
      正在识别码...
    </div>
    <div v-if="error" class="scan-error">
      <el-icon><WarningFilled /></el-icon>
      {{ error }}
    </div>
    <div v-if="error" class="scan-error-actions">
      <el-button size="small" type="primary" plain @click="startLiveScan">重新扫码</el-button>
      <el-button size="small" plain @click="triggerPhotoScan">拍照识别</el-button>
    </div>

    <el-dialog
      v-model="scannerDialogVisible"
      title="扫描商品编号"
      :width="dialogWidth"
      :fullscreen="isMobileViewport"
      class="scanner-dialog"
      :close-on-click-modal="false"
      @closed="stopLiveScan"
    >
      <div class="live-scanner">
        <div class="scanner-preview">
          <video
            ref="videoRef"
            class="scanner-video"
            autoplay
            muted
            playsinline
            webkit-playsinline
          ></video>
          <div class="scanner-frame"></div>
        </div>
        <p class="scanner-tip">请将商品条形码完整放入横向取景框。若画面为黑色，请允许相机权限并退出无痕浏览后重试。</p>
      </div>
      <template #footer>
        <div class="scanner-footer">
          <el-button @click="scannerDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const barcode = ref(props.modelValue)
const fileInputRef = ref(null)
const videoRef = ref(null)
const scanning = ref(false)
const liveScanning = ref(false)
const scannerDialogVisible = ref(false)
const error = ref('')
const fileScannerId = `barcode-file-${Math.random().toString(36).slice(2)}`
const isMobileViewport = ref(window.innerWidth <= 768)
let mediaStream = null
let zxingLiveReader = null
let zxingModulePromise = null
const dialogWidth = computed(() => isMobileViewport.value ? '100%' : '420px')

const handleResize = () => {
  isMobileViewport.value = window.innerWidth <= 768
}

const getSupportedFormats = (Html5QrcodeSupportedFormats) => [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
]

const loadZxing = () => {
  if (!zxingModulePromise) zxingModulePromise = import('@zxing/library')
  return zxingModulePromise
}

const createZxingHints = (zxing) => {
  const hints = new Map()
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
    zxing.BarcodeFormat.QR_CODE,
    zxing.BarcodeFormat.EAN_13,
    zxing.BarcodeFormat.EAN_8,
    zxing.BarcodeFormat.CODE_128,
    zxing.BarcodeFormat.CODE_39,
    zxing.BarcodeFormat.UPC_A,
    zxing.BarcodeFormat.UPC_E,
    zxing.BarcodeFormat.ITF,
    zxing.BarcodeFormat.DATA_MATRIX,
  ])
  hints.set(zxing.DecodeHintType.TRY_HARDER, true)
  hints.set(zxing.DecodeHintType.CHARACTER_SET, 'UTF-8')
  return hints
}

watch(() => props.modelValue, (val) => {
  if (val !== barcode.value) barcode.value = val
})

const onInput = () => {
  error.value = ''
  emit('update:modelValue', barcode.value)
}

const triggerPhotoScan = () => {
  error.value = ''
  fileInputRef.value?.click()
}

const applyScanResult = (result) => {
  const normalized = String(result || '').trim()
  if (!normalized) return
  barcode.value = normalized
  emit('update:modelValue', normalized)
  error.value = ''
}

function withTimeout(promise, ms, fallback = null) {
  let timer
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(fallback), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

const startLiveScan = async () => {
  error.value = ''
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    error.value = '手机实时扫码需要 HTTPS 环境，请使用 HTTPS 访问系统'
    return
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '当前浏览器不支持实时摄像头扫码，请使用拍照识别或手动输入'
    return
  }

  scannerDialogVisible.value = true
  await nextTick()
  liveScanning.value = true

  try {
    await startZxingLiveScan()
  } catch (err) {
    console.error('Live scan error:', err)
    error.value = '无法打开摄像头。请在 Safari 相机权限选择允许，并尽量使用普通浏览模式重试'
    liveScanning.value = false
  }
}

const stopLiveScan = async () => {
  if (zxingLiveReader) {
    try {
      zxingLiveReader.stopContinuousDecode()
      zxingLiveReader.stopAsyncDecode()
      zxingLiveReader.reset?.()
    } catch (err) {
      console.warn('Stop ZXing scanner failed:', err)
    }
    zxingLiveReader = null
  }
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.srcObject = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop())
    mediaStream = null
  }
  liveScanning.value = false
}

async function startZxingLiveScan() {
  const video = videoRef.value
  if (!video) throw new Error('video element not ready')

  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('autoplay', 'true')
  video.setAttribute('muted', 'true')
  video.muted = true

  const zxing = await loadZxing()
  zxingLiveReader = new zxing.BrowserMultiFormatReader(createZxingHints(zxing), 250)

  await zxingLiveReader.decodeFromConstraints({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  }, video, (result, err) => {
    if (result) {
      applyScanResult(result.getText())
      scannerDialogVisible.value = false
    } else if (err && err.name && err.name !== 'NotFoundException') {
      console.warn('ZXing live scan warning:', err)
    }
  })

  mediaStream = video.srcObject
  await withTimeout(video.play(), 4000)
}

const onFileSelected = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  scanning.value = true
  error.value = ''

  try {
    const img = await loadImageFromFile(file)
    const canvas = imageToCanvas(img, 2400)
    const enhancedCanvas = createEnhancedCanvas(canvas)
    const rotatedCanvas = createRotatedCanvas(canvas)
    const rotatedEnhancedCanvas = createEnhancedCanvas(rotatedCanvas)

    let result = await withTimeout(decodeWithZxingCanvases([
      canvas,
      enhancedCanvas,
      rotatedCanvas,
      rotatedEnhancedCanvas,
    ]), 8000)

    // 方案2：html5-qrcode 文件识别，对部分二维码图片有效。
    if (!result) {
      result = await withTimeout(decodeFileWithHtml5Qrcode(file), 5000)
    }

    // 方案3：浏览器原生 BarcodeDetector（Android Chrome 支持）
    if (!result) {
      result = await decodeWithBarcodeDetector(canvas)
        || await decodeWithBarcodeDetector(enhancedCanvas)
        || await decodeWithBarcodeDetector(rotatedCanvas)
        || await decodeWithBarcodeDetector(rotatedEnhancedCanvas)
    }

    // 方案4：Quagga2 识别条形码（纯JS，iOS/Android都支持）
    if (!result) {
      result = await withTimeout(decodeBarcodeWithQuagga(canvas), 5000)
        || await withTimeout(decodeBarcodeWithQuagga(enhancedCanvas), 5000)
        || await withTimeout(decodeBarcodeWithQuagga(rotatedCanvas), 5000)
        || await withTimeout(decodeBarcodeWithQuagga(rotatedEnhancedCanvas), 5000)
    }

    // 方案5：jsQR 识别二维码
    if (!result) {
      result = await withTimeout(decodeQRCode(canvas), 3000)
        || await withTimeout(decodeQRCode(enhancedCanvas), 3000)
        || await withTimeout(decodeQRCode(rotatedCanvas), 3000)
        || await withTimeout(decodeQRCode(rotatedEnhancedCanvas), 3000)
    }

    if (result) {
      applyScanResult(result)
    } else {
      error.value = '未识别到条形码或二维码。请让码占画面1/3以上、保持水平、避免反光，或使用实时扫码'
    }
  } catch (err) {
    console.error('Scan error:', err)
    error.value = '图片处理失败，请重试'
  } finally {
    scanning.value = false
    e.target.value = ''
  }
}

async function decodeFileWithHtml5Qrcode(file) {
  let scanner = null
  try {
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
    scanner = new Html5Qrcode(fileScannerId, {
      formatsToSupport: getSupportedFormats(Html5QrcodeSupportedFormats),
      verbose: false,
    })
    return await withTimeout(scanner.scanFile(file, false), 5000)
  } catch (err) {
    console.warn('Html5Qrcode file scan failed:', err)
    return null
  } finally {
    if (scanner) {
      try {
        await scanner.clear()
      } catch (e) {}
    }
  }
}

async function decodeWithBarcodeDetector(canvas) {
  if (!('BarcodeDetector' in window)) return null
  try {
    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code', 'itf']
    })
    const barcodes = await withTimeout(detector.detect(canvas), 2500, [])
    return barcodes?.[0]?.rawValue || null
  } catch (e) {
    console.warn('BarcodeDetector failed:', e)
    return null
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = reader.result
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}

function imageToCanvas(img, maxSize) {
  let w = img.naturalWidth || img.width
  let h = img.naturalHeight || img.height
  if (w > maxSize || h > maxSize) {
    const scale = maxSize / Math.max(w, h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

function createEnhancedCanvas(sourceCanvas) {
  const canvas = document.createElement('canvas')
  canvas.width = sourceCanvas.width
  canvas.height = sourceCanvas.height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(sourceCanvas, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const contrast = 1.35
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const adjusted = Math.max(0, Math.min(255, (gray - 128) * contrast + 128))
    data[i] = adjusted
    data[i + 1] = adjusted
    data[i + 2] = adjusted
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

function createRotatedCanvas(sourceCanvas) {
  const canvas = document.createElement('canvas')
  canvas.width = sourceCanvas.height
  canvas.height = sourceCanvas.width
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(sourceCanvas, -sourceCanvas.width / 2, -sourceCanvas.height / 2)
  return canvas
}

async function decodeWithZxingCanvases(canvases) {
  for (const canvas of canvases) {
    const result = await decodeWithZxingCanvas(canvas)
    if (result) return result
  }
  return null
}

async function decodeWithZxingCanvas(canvas) {
  try {
    const zxing = await loadZxing()
    const reader = new zxing.BrowserMultiFormatReader(createZxingHints(zxing), 250)
    const source = new zxing.HTMLCanvasElementLuminanceSource(canvas)
    const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source))
    return reader.decodeBitmap(bitmap).getText()
  } catch (err) {
    try {
      const zxing = await loadZxing()
      const reader = new zxing.BrowserMultiFormatReader(createZxingHints(zxing), 250)
      const source = new zxing.HTMLCanvasElementLuminanceSource(canvas).invert()
      const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source))
      return reader.decodeBitmap(bitmap).getText()
    } catch (invertedErr) {
      return null
    }
  }
}

async function decodeQRCode(canvas) {
  const module = await import('jsqr')
  const jsQR = module.default
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth'
  })
  return code?.data || null
}

function decodeBarcodeWithQuagga(canvas) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const timer = setTimeout(() => finish(null), 4500)

    import('@ericblade/quagga2').then((module) => {
      const Quagga = module.default || module
      const imageDataUrl = canvas.toDataURL('image/png')
      Quagga.decodeSingle({
        src: imageDataUrl,
        numOfWorkers: 0,
        inputStream: {
          size: Math.min(1600, Math.max(canvas.width, canvas.height)),
          singleChannel: false,
        },
        locator: {
          patchSize: 'medium',
          halfSample: false,
        },
        decoder: {
          readers: [
            'ean_reader',
            'ean_8_reader',
            'code_128_reader',
            'code_39_reader',
            'upc_reader',
            'upc_e_reader',
            'itf_reader',
          ],
          multiple: false,
        },
        locate: true,
      }, (result) => {
        clearTimeout(timer)
        if (result && result.codeResult && result.codeResult.code) {
          finish(result.codeResult.code)
        } else {
          finish(null)
        }
      })
    }).catch((err) => {
      clearTimeout(timer)
      console.warn('Quagga load failed:', err)
      finish(null)
    })
  })
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  stopLiveScan()
})
</script>

<style scoped>
.barcode-scanner {
  width: 100%;
}
.scanner-input-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.scanner-input-row .el-input {
  flex: 1;
  min-width: 180px;
}
.scan-btn {
  white-space: nowrap;
  flex-shrink: 0;
  min-height: 40px;
}
.live-scanner {
  display: grid;
  gap: 12px;
}
.scanner-preview {
  position: relative;
  width: 100%;
  min-height: 300px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 8px;
  background: #111827;
}
.scanner-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #111827;
}
.scanner-frame {
  position: absolute;
  left: 7%;
  right: 7%;
  top: 37%;
  height: 22%;
  border: 2px solid #20d6a3;
  border-radius: 10px;
  box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}
.scanner-frame::before {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  top: 50%;
  height: 2px;
  background: rgba(32, 214, 163, 0.85);
}
.scanner-tip {
  margin: 0;
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}
.scanning-hint,
.scan-error {
  margin-top: 8px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.scanning-hint {
  color: #409eff;
}
.scan-error {
  color: #f56c6c;
}
.scan-error-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.scanner-footer {
  padding-bottom: env(safe-area-inset-bottom);
}
.file-scanner-host {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

@media screen and (max-width: 768px) {
  .scanner-input-row {
    display: grid;
    grid-template-columns: 1fr;
  }
  .scanner-input-row .el-input {
    min-width: 0;
  }
  .scan-btn {
    width: 100%;
  }
  .scanner-preview {
    min-height: min(62vh, 560px);
    aspect-ratio: auto;
    border-radius: 0;
  }
  :deep(.scanner-dialog.el-dialog.is-fullscreen) {
    display: flex;
    flex-direction: column;
  }
  :deep(.scanner-dialog.el-dialog.is-fullscreen .el-dialog__body) {
    flex: 1;
    overflow: auto;
    padding: 12px;
  }
  :deep(.scanner-dialog.el-dialog.is-fullscreen .el-dialog__footer) {
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    border-top: 1px solid #ebeef5;
  }
  :deep(.scanner-dialog.el-dialog.is-fullscreen .el-dialog__footer .el-button) {
    width: 100%;
    min-height: 42px;
  }
}
</style>
