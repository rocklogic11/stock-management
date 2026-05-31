<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="page-header">
        <span style="font-size:16px;font-weight:bold">库存预警商品</span>
        <el-button type="primary" @click="openSettingDialog()" v-if="userStore.hasPermission('alert_manage')">
          <el-icon><Setting /></el-icon>预警设置
        </el-button>
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="sku_code" label="SKU编码" width="130" />
        <el-table-column prop="product_name" label="商品名称" min-width="160" />
        <el-table-column prop="category.category_name" label="分类" width="100" />
        <el-table-column prop="stock_quantity" label="当前库存" width="100" align="center">
          <template #default="{ row }">
            <span style="color:#f56c6c;font-weight:bold">{{ row.stock_quantity }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="alert_threshold" label="预警阈值" width="100" align="center" />
        <el-table-column label="缺口数量" width="100" align="center">
          <template #default="{ row }">
            <span style="color:#f56c6c">{{ row.alert_threshold - row.stock_quantity }}</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        layout="total, prev, pager, next" @current-change="fetchData" style="margin-top:16px; justify-content:flex-end" />
    </el-card>

    <!-- 预警设置列表 -->
    <el-dialog v-model="settingDialogVisible" title="预警设置" width="700px" top="5vh">
      <div style="margin-bottom:12px">
        <el-button type="primary" size="small" @click="openAddSetting">添加预警</el-button>
      </div>
      <el-table :data="settings" stripe size="small">
        <el-table-column prop="product.sku_code" label="SKU" width="130" />
        <el-table-column prop="product.product_name" label="商品名称" />
        <el-table-column prop="product.stock_quantity" label="当前库存" width="100" align="center" />
        <el-table-column prop="alert_threshold" label="预警阈值" width="100" align="center" />
        <el-table-column prop="is_active" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" size="small">{{ row.is_active ? '启用' : '禁用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editSetting(row)">编辑</el-button>
            <el-button link :type="row.is_active ? 'danger' : 'success'" size="small" @click="toggleSetting(row)">
              {{ row.is_active ? '禁用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 添加/编辑预警弹窗 -->
    <el-dialog v-model="addSettingVisible" :title="editingSettingId ? '编辑预警' : '添加预警'" width="400px">
      <el-form :model="settingForm" label-width="80px">
        <el-form-item label="商品" v-if="!editingSettingId">
          <el-select v-model="settingForm.product_id" placeholder="选择商品" filterable style="width:100%">
            <el-option v-for="p in productList" :key="p.id" :label="`${p.sku_code} - ${p.product_name}`" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="预警阈值">
          <el-input-number v-model="settingForm.alert_threshold" :min="1" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addSettingVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSetting">确认</el-button>
      </template>
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

const settingDialogVisible = ref(false)
const addSettingVisible = ref(false)
const editingSettingId = ref(null)
const settings = ref([])
const productList = ref([])
const settingForm = reactive({ product_id: '', alert_threshold: 10 })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/stock-alerts', { params: { page: page.value, page_size: pageSize.value } })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

const openSettingDialog = async () => {
  await fetchSettings()
  settingDialogVisible.value = true
}

const fetchSettings = async () => {
  const res = await request.get('/stock-alerts/settings', { params: { page_size: 100 } })
  settings.value = res.data.items
}

const openAddSetting = async () => {
  editingSettingId.value = null
  settingForm.product_id = ''
  settingForm.alert_threshold = 10
  const res = await request.get('/products', { params: { page_size: 200 } })
  productList.value = res.data.items
  addSettingVisible.value = true
}

const editSetting = (row) => {
  editingSettingId.value = row.id
  settingForm.product_id = row.product_id
  settingForm.alert_threshold = row.alert_threshold
  addSettingVisible.value = true
}

const saveSetting = async () => {
  try {
    if (editingSettingId.value) {
      await request.put(`/stock-alerts/settings/${editingSettingId.value}`, settingForm)
    } else {
      await request.post('/stock-alerts/settings', settingForm)
    }
    ElMessage.success('保存成功')
    addSettingVisible.value = false
    fetchSettings()
    fetchData()
  } catch (e) {}
}

const toggleSetting = async (row) => {
  await request.put(`/stock-alerts/settings/${row.id}`, { is_active: row.is_active ? 0 : 1 })
  ElMessage.success(row.is_active ? '已禁用' : '已启用')
  fetchSettings()
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
</style>
