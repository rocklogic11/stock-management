<template>
  <div class="product-images">
    <div class="image-list">
      <div v-for="(url, index) in imageUrls" :key="index" class="image-item">
        <el-image :src="url" fit="cover" class="image-thumb" :preview-src-list="imageUrls" :initial-index="index" />
        <div class="image-actions">
          <el-icon class="remove-btn" @click="removeImage(index)"><Close /></el-icon>
        </div>
      </div>
      <div v-if="imageUrls.length < 4" class="image-add" @click="triggerUpload">
        <el-icon :size="28"><Plus /></el-icon>
        <span>添加图片</span>
        <span class="sub-text">({{ imageUrls.length }}/4)</span>
      </div>
    </div>
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      multiple
      style="display: none"
      @change="onFileSelected"
    />
    <div v-if="uploading" class="upload-hint">
      <el-icon class="is-loading"><Loading /></el-icon>
      上传中...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import request from '../utils/request'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'uploaded', 'removed'])

const fileInputRef = ref(null)
const uploading = ref(false)

const imageUrls = computed(() => props.modelValue || [])

watch(() => props.modelValue, (val) => {
  // sync
}, { deep: true })

const triggerUpload = () => {
  fileInputRef.value?.click()
}

const onFileSelected = async (e) => {
  const files = Array.from(e.target.files || [])
  if (!files.length) return

  const remaining = 4 - imageUrls.value.length
  if (remaining <= 0) {
    ElMessage.warning('最多上传4张图片')
    e.target.value = ''
    return
  }
  if (files.length > remaining) {
    ElMessage.warning(`最多上传4张图片，还可添加${remaining}张`)
    files.splice(remaining)
  }
  if (files.length === 0) {
    e.target.value = ''
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    files.forEach(f => formData.append('images', f))

    const res = await request.post('/upload/product-images', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    if (res.data?.images) {
      const newUrls = [...imageUrls.value, ...res.data.images]
      emit('update:modelValue', newUrls)
      emit('uploaded', res.data.images)
    }
  } catch (err) {
    ElMessage.error('图片上传失败')
    console.error('Upload error:', err)
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

const removeImage = (index) => {
  const newUrls = [...imageUrls.value]
  const removed = newUrls.splice(index, 1)
  emit('update:modelValue', newUrls)
  if (removed[0]) emit('removed', removed[0])
}
</script>

<style scoped>
.product-images {
  width: 100%;
}
.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.image-item {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}
.image-thumb {
  width: 100%;
  height: 100%;
}
.image-actions {
  position: absolute;
  top: 0;
  right: 0;
}
.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0,0,0,0.5);
  color: #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}
.remove-btn:hover {
  background: rgba(245,108,108,0.9);
}
.image-add {
  width: 100px;
  height: 100px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #909399;
  font-size: 13px;
  gap: 4px;
  transition: border-color 0.2s;
}
.image-add:hover {
  border-color: #409eff;
  color: #409eff;
}
.sub-text {
  font-size: 11px;
  color: #c0c4cc;
}
.upload-hint {
  margin-top: 8px;
  font-size: 13px;
  color: #409eff;
  display: flex;
  align-items: center;
  gap: 4px;
}

@media screen and (max-width: 768px) {
  .image-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .image-item,
  .image-add {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }
}
</style>
