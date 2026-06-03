<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="page-header">
        <div class="search-bar">
          <el-input v-model="keyword" placeholder="搜索商品名称/SKU/商品编号" clearable style="width:260px" @clear="fetchData" @keyup.enter="fetchData">
            <template #append><el-button @click="fetchData" icon="Search" /></template>
          </el-input>
          <el-select v-model="categoryId" placeholder="选择分类" clearable style="width:160px" @change="fetchData">
            <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
          </el-select>
        </div>
        <el-button class="add-product-btn" type="primary" @click="openDialog()" v-if="canManageProducts">
          <el-icon><Plus /></el-icon>新增商品
        </el-button>
      </div>

      <el-table v-if="!isMobile" :data="list" stripe v-loading="loading">
        <el-table-column label="图片" width="70" align="center">
          <template #default="{ row }">
            <el-image v-if="row.images && row.images.length > 0" :src="row.images[0]" fit="cover" style="width:40px;height:40px;border-radius:4px" :preview-src-list="row.images" />
            <span v-else style="color:#c0c4cc;font-size:12px">无图</span>
          </template>
        </el-table-column>
        <el-table-column prop="sku_code" label="SKU编码" width="130" />
        <el-table-column prop="product_name" label="商品名称" min-width="140" />
        <el-table-column prop="barcode" label="商品编号" width="130">
          <template #default="{ row }">
            <span>{{ row.barcode || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category.category_name" label="分类" width="100" />
        <el-table-column prop="cost_price" label="成本价" width="100" align="right">
          <template #default="{ row }">¥{{ row.cost_price }}</template>
        </el-table-column>
        <el-table-column prop="retail_price" label="零售价" width="100" align="right">
          <template #default="{ row }">¥{{ row.retail_price }}</template>
        </el-table-column>
        <el-table-column prop="stock_quantity" label="库存" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '在售' : '下架' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="generateQR(row)" v-if="canManageProducts">二维码</el-button>
            <el-button link type="primary" size="small" @click="openDialog(row)" v-if="canManageProducts">编辑</el-button>
            <el-button link :type="row.status === 1 ? 'danger' : 'success'" size="small" @click="toggleStatus(row)" v-if="canManageProducts">
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-else class="mobile-product-list" v-loading="loading">
        <div v-for="row in list" :key="row.id" class="mobile-product-card">
          <el-image
            v-if="row.images && row.images.length > 0"
            :src="row.images[0]"
            fit="cover"
            class="mobile-product-image"
            :preview-src-list="row.images"
          />
          <div v-else class="mobile-product-image empty">无图</div>
          <div class="mobile-product-main">
            <div class="mobile-product-title">{{ row.product_name }}</div>
            <div class="mobile-product-code">{{ row.sku_code }}<span v-if="row.barcode"> / {{ row.barcode }}</span></div>
            <div class="mobile-product-meta">
              <span>{{ row.category?.category_name || '-' }}</span>
              <span>库存 {{ row.stock_quantity }}</span>
              <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">{{ row.status === 1 ? '在售' : '下架' }}</el-tag>
            </div>
            <div class="mobile-product-actions">
              <el-button size="small" type="primary" plain @click="openDialog(row)" v-if="canManageProducts">编辑</el-button>
              <el-button size="small" plain @click="generateQR(row)" v-if="canManageProducts">二维码</el-button>
              <el-button size="small" :type="row.status === 1 ? 'danger' : 'success'" plain @click="toggleStatus(row)" v-if="canManageProducts">
                {{ row.status === 1 ? '下架' : '上架' }}
              </el-button>
            </div>
          </div>
        </div>
        <el-empty v-if="!loading && list.length === 0" description="暂无商品" />
      </div>

      <el-pagination
        v-model:current-page="page" v-model:page-size="pageSize"
        :total="total" :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="fetchData" @size-change="fetchData"
        style="margin-top:16px; justify-content:flex-end"
      />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑商品' : '新增商品'"
      :width="isMobile ? '100%' : '560px'"
      :fullscreen="isMobile"
      :close-on-click-modal="false"
      class="product-dialog"
      :before-close="handleDialogClose"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" class="product-form">
        <el-form-item label="商品名称" prop="product_name">
          <el-input v-model="form.product_name" />
        </el-form-item>
        <el-form-item label="商品编号" prop="barcode">
          <BarcodeScanner v-model="form.barcode" />
        </el-form-item>
        <el-form-item label="分类" prop="category_id">
          <el-select
            v-model="form.category_id"
            placeholder="选择分类"
            style="width:100%"
            :loading="categoryLoading"
            @visible-change="handleCategoryVisibleChange"
          >
            <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
            <template #empty>
              <div class="select-empty">
                <span>{{ categoryLoading ? '分类加载中...' : '暂无可用分类' }}</span>
                <el-button v-if="!categoryLoading" link type="primary" @click.stop="fetchCategories">重新加载</el-button>
              </div>
            </template>
          </el-select>
        </el-form-item>
        <el-form-item label="成本价" prop="cost_price">
          <el-input-number v-model="form.cost_price" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="零售价" prop="retail_price">
          <el-input-number v-model="form.retail_price" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="初始库存" prop="stock_quantity" v-if="!editingId">
          <el-input-number v-model="form.stock_quantity" :min="0" style="width:100%" />
        </el-form-item>
        <el-form-item label="商品图片">
          <ProductImages v-model="form.images" @uploaded="handleImageUploaded" @removed="handleImageRemoved" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="product-dialog-footer">
          <el-button :disabled="submitLoading" @click="handleDialogClose">取消</el-button>
          <el-button type="primary" :loading="submitLoading" :disabled="categoryLoading" @click="submitForm">
            {{ editingId ? '保存修改' : '创建商品' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 二维码弹窗 -->
    <el-dialog v-model="qrDialogVisible" title="商品二维码" width="300px">
      <div style="text-align:center">
        <p style="margin-bottom:12px;font-weight:bold">{{ qrProduct?.product_name }}</p>
        <p style="margin-bottom:12px;color:#909399">{{ qrProduct?.sku_code }}</p>
        <el-image v-if="qrProduct?.qr_code" :src="qrProduct.qr_code" style="width:200px;height:200px" fit="contain" />
        <p v-else style="color:#909399;margin-top:12px">二维码生成中...</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import { ElMessage } from 'element-plus'
import BarcodeScanner from '../components/BarcodeScanner.vue'
import ProductImages from '../components/ProductImages.vue'

const userStore = useUserStore()
const canManageProducts = computed(() => userStore.hasPermission('product_manage'))
const loading = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const categoryId = ref('')
const categories = ref([])
const categoryLoading = ref(false)
const submitLoading = ref(false)

const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const form = reactive({ product_name: '', category_id: '', cost_price: 0, retail_price: 0, stock_quantity: 0, barcode: '', images: [] })
const originalImages = ref([])
const uploadedSessionImages = ref([])
const removedPersistedImages = ref([])
const dialogSaved = ref(false)
const rules = {
  product_name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

const qrDialogVisible = ref(false)
const qrProduct = ref(null)

const onResize = () => { isMobile.value = window.innerWidth <= 768 }

const ensurePermissions = async () => {
  if (!userStore.token) return
  if (Object.keys(userStore.permissions || {}).length > 0) return
  await userStore.fetchUserInfo().catch(() => {})
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/products', { params: { page: page.value, page_size: pageSize.value, keyword: keyword.value, category_id: categoryId.value } })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

const normalizeList = (value) => Array.isArray(value) ? value : []

const fetchCategories = async () => {
  categoryLoading.value = true
  try {
    const res = await request.get('/categories')
    categories.value = normalizeList(res.data)
    if (categories.value.length === 0) {
      ElMessage.warning('暂无可用商品分类，请先维护分类')
    }
  } finally {
    categoryLoading.value = false
  }
}

const handleCategoryVisibleChange = (visible) => {
  if (visible && categories.value.length === 0 && !categoryLoading.value) {
    fetchCategories()
  }
}

const openDialog = async (row) => {
  if (categories.value.length === 0 && !categoryLoading.value) {
    await fetchCategories().catch(() => {})
  }
  editingId.value = row?.id || null
  dialogSaved.value = false
  uploadedSessionImages.value = []
  removedPersistedImages.value = []
  if (row) {
    originalImages.value = [...(row.images || [])]
    Object.assign(form, {
      product_name: row.product_name,
      category_id: row.category_id,
      cost_price: row.cost_price,
      retail_price: row.retail_price,
      barcode: row.barcode || '',
      images: row.images || [],
    })
  } else {
    originalImages.value = []
    Object.assign(form, { product_name: '', category_id: '', cost_price: 0, retail_price: 0, stock_quantity: 0, barcode: '', images: [] })
  }
  dialogVisible.value = true
}

const handleImageUploaded = (urls) => {
  uploadedSessionImages.value.push(...urls)
}

const handleImageRemoved = async (url) => {
  if (uploadedSessionImages.value.includes(url) && !originalImages.value.includes(url)) {
    uploadedSessionImages.value = uploadedSessionImages.value.filter(item => item !== url)
    await deleteProductImage(url)
    return
  }
  if (originalImages.value.includes(url) && !removedPersistedImages.value.includes(url)) {
    removedPersistedImages.value.push(url)
  }
}

const deleteProductImage = async (url) => {
  try {
    await request.post('/upload/product-image/delete', { url })
  } catch (e) {}
}

const cleanupUnsavedImages = async () => {
  const current = new Set(form.images || [])
  const unsaved = uploadedSessionImages.value.filter(url => current.has(url) && !originalImages.value.includes(url))
  await Promise.all(unsaved.map(deleteProductImage))
}

const cleanupRemovedPersistedImages = async () => {
  const current = new Set(form.images || [])
  const removed = removedPersistedImages.value.filter(url => !current.has(url))
  await Promise.all(removed.map(deleteProductImage))
}

const resetDialogTracking = () => {
  originalImages.value = []
  uploadedSessionImages.value = []
  removedPersistedImages.value = []
  dialogSaved.value = false
}

const handleDialogClose = async (done) => {
  if (!dialogSaved.value) {
    await cleanupUnsavedImages()
  }
  resetDialogTracking()
  if (typeof done === 'function') done()
  else dialogVisible.value = false
}

const submitForm = async () => {
  if (submitLoading.value) return
  if (categories.value.length === 0) {
    await fetchCategories().catch(() => {})
  }
  if (categories.value.length === 0) {
    ElMessage.error('商品分类未加载，暂不能保存商品')
    return
  }
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitLoading.value = true
  try {
    if (editingId.value) {
      await request.put(`/products/${editingId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await request.post('/products', form)
      ElMessage.success('创建成功')
    }
    dialogSaved.value = true
    await cleanupRemovedPersistedImages()
    resetDialogTracking()
    dialogVisible.value = false
    fetchData()
  } catch (e) {
  } finally {
    submitLoading.value = false
  }
}

const toggleStatus = async (row) => {
  await request.put(`/products/${row.id}`, { status: row.status === 1 ? 0 : 1 })
  ElMessage.success(row.status === 1 ? '已下架' : '已上架')
  fetchData()
}

const generateQR = async (row) => {
  try {
    const res = await request.post(`/products/${row.id}/qrcode`)
    qrProduct.value = { ...row, qr_code: res.data.qr_code }
    qrDialogVisible.value = true
    fetchData()
  } catch (e) {}
}

onMounted(async () => {
  await ensurePermissions()
  fetchData()
  fetchCategories()
  window.addEventListener('resize', onResize)
})
onUnmounted(() => { window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.page-container { padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.search-bar { display: flex; gap: 12px; flex: 1; min-width: 0; }
.add-product-btn { flex-shrink: 0; }
.mobile-product-list { display: grid; gap: 10px; }
.mobile-product-card {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}
.mobile-product-image {
  width: 88px;
  height: 88px;
  border-radius: 8px;
  background: #f5f7fa;
}
.mobile-product-image.empty {
  display: grid;
  place-items: center;
  color: #c0c4cc;
  font-size: 12px;
}
.mobile-product-main { min-width: 0; display: grid; gap: 6px; }
.mobile-product-title { font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-product-code { color: #909399; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mobile-product-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: #606266; font-size: 12px; }
.mobile-product-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 2px; }
.select-empty {
  display: grid;
  gap: 4px;
  justify-items: center;
  padding: 8px;
  color: #909399;
  font-size: 13px;
}
.product-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

@media screen and (max-width: 768px) {
  .page-header {
    display: grid;
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .search-bar {
    display: grid;
    grid-template-columns: 1fr;
  }
  .search-bar :deep(.el-input),
  .search-bar :deep(.el-select) {
    width: 100% !important;
  }
  .add-product-btn {
    width: 100%;
    min-height: 42px;
  }
  :deep(.product-dialog.el-dialog.is-fullscreen) {
    display: flex;
    flex-direction: column;
  }
  :deep(.product-dialog.el-dialog.is-fullscreen .el-dialog__body) {
    flex: 1;
    overflow: auto;
    padding: 12px 14px 92px;
  }
  :deep(.product-dialog .el-dialog__body) {
    padding-bottom: 76px;
  }
  :deep(.product-dialog .el-dialog__footer) {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
    background: #fff;
    box-shadow: 0 -4px 14px rgba(0,0,0,0.08);
  }
  .product-dialog-footer {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  :deep(.product-dialog .el-dialog__footer .el-button) {
    width: 100%;
    min-width: 0;
    min-height: 42px;
    margin-left: 0;
  }
  :deep(.product-dialog .el-form-item) {
    display: block;
  }
  :deep(.product-dialog .el-form-item__label) {
    justify-content: flex-start;
    width: auto !important;
    line-height: 22px;
    margin-bottom: 6px;
  }
  :deep(.product-dialog .el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
