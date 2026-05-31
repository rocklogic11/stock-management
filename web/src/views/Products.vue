<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="page-header">
        <div class="search-bar">
          <el-input v-model="keyword" placeholder="搜索商品名称/SKU" clearable style="width:240px" @clear="fetchData" @keyup.enter="fetchData">
            <template #append><el-button @click="fetchData" icon="Search" /></template>
          </el-input>
          <el-select v-model="categoryId" placeholder="选择分类" clearable style="width:160px" @change="fetchData">
            <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
          </el-select>
        </div>
        <el-button type="primary" @click="openDialog()" v-if="userStore.hasPermission('product_manage')">
          <el-icon><Plus /></el-icon>新增商品
        </el-button>
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="sku_code" label="SKU编码" width="130" />
        <el-table-column prop="product_name" label="商品名称" min-width="160" />
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
            <el-button link type="primary" size="small" @click="generateQR(row)" v-if="userStore.hasPermission('product_manage')">二维码</el-button>
            <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
            <el-button link :type="row.status === 1 ? 'danger' : 'success'" size="small" @click="toggleStatus(row)">
              {{ row.status === 1 ? '下架' : '上架' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page" v-model:page-size="pageSize"
        :total="total" :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="fetchData" @size-change="fetchData"
        style="margin-top:16px; justify-content:flex-end"
      />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑商品' : '新增商品'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="商品名称" prop="product_name">
          <el-input v-model="form.product_name" />
        </el-form-item>
        <el-form-item label="分类" prop="category_id">
          <el-select v-model="form.category_id" placeholder="选择分类" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
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
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确认</el-button>
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
import { ref, reactive, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()
const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const categoryId = ref('')
const categories = ref([])

const dialogVisible = ref(false)
const editingId = ref(null)
const formRef = ref(null)
const form = reactive({ product_name: '', category_id: '', cost_price: 0, retail_price: 0, stock_quantity: 0 })
const rules = {
  product_name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

const qrDialogVisible = ref(false)
const qrProduct = ref(null)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/products', { params: { page: page.value, page_size: pageSize.value, keyword: keyword.value, category_id: categoryId.value } })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

const fetchCategories = async () => {
  const res = await request.get('/categories')
  categories.value = res.data
}

const openDialog = (row) => {
  editingId.value = row?.id || null
  if (row) {
    Object.assign(form, { product_name: row.product_name, category_id: row.category_id, cost_price: row.cost_price, retail_price: row.retail_price })
  } else {
    Object.assign(form, { product_name: '', category_id: '', cost_price: 0, retail_price: 0, stock_quantity: 0 })
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    if (editingId.value) {
      await request.put(`/products/${editingId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await request.post('/products', form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (e) {}
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

onMounted(() => { fetchData(); fetchCategories() })
</script>

<style scoped>
.page-container { padding: 0; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-bar { display: flex; gap: 12px; }
</style>
