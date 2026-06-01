<template>
  <div class="page-container">
    <!-- 入库单列表 -->
    <el-card shadow="never" v-if="!workbenchMode">
      <div class="page-header">
        <div class="search-bar">
          <el-select v-model="status" placeholder="状态" clearable style="width:120px" @change="fetchData">
            <el-option label="草稿" :value="2" /><el-option label="已完成" :value="1" />
          </el-select>
        </div>
        <el-button type="primary" @click="startWorkbench" v-if="userStore.hasPermission('inbound_manage')">
          <el-icon><Plus /></el-icon>扫码入库
        </el-button>
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="order_no" label="单号" width="180" />
        <el-table-column prop="user.real_name" label="操作人" width="100" />
        <el-table-column prop="total_quantity" label="总数量" width="100" align="center" />
        <el-table-column prop="total_amount" label="总金额" width="120" align="right" v-if="userStore.isOwner">
          <template #default="{ row }">¥{{ row.total_amount }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'warning'" size="small">{{ row.status === 1 ? '已完成' : '草稿' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">详情</el-button>
            <el-button link type="success" size="small" @click="confirmOrder(row)" v-if="row.status === 2 && userStore.hasPermission('inbound_manage')">确认入库</el-button>
            <el-button link type="danger" size="small" @click="deleteOrder(row)" v-if="row.status === 2">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        layout="total, prev, pager, next" @current-change="fetchData" style="margin-top:16px; justify-content:flex-end" />
    </el-card>

    <!-- 扫码入库作业台 -->
    <div v-if="workbenchMode" class="workbench">
      <div class="workbench-left">
        <el-card shadow="never">
          <template #header>
            <div class="workbench-header">
              <span>扫码入库作业台</span>
              <el-button text @click="exitWorkbench">返回列表</el-button>
            </div>
          </template>
          <div class="scan-area">
            <div class="scan-box">
              <div class="scan-title">扫描或输入 SKU / 商品编号</div>
              <el-input
                ref="scanInputRef"
                v-model="scanInput"
                placeholder="扫描条码/商品编号或输入SKU编码，回车添加"
                size="large"
                clearable
                @keydown.enter="handleScan"
                class="scan-input"
              >
                <template #prefix><el-icon><Search /></el-icon></template>
              </el-input>
              <div class="scan-feedback" :class="feedback.type">
                <strong>{{ feedback.title }}</strong>
                <span>{{ feedback.desc }}</span>
              </div>
              <div class="scan-actions">
                <el-button @click="demoScan">模拟扫码</el-button>
                <el-button type="danger" plain @click="undoScan" :disabled="scanHistory.length === 0">撤销上一次</el-button>
                <el-button type="primary" @click="confirmInbound" :disabled="workbenchItems.length === 0">确认入库</el-button>
              </div>
            </div>
            <div class="remark-area">
              <el-input v-model="workbenchRemark" placeholder="入库备注（可选）" />
            </div>
          </div>
        </el-card>
      </div>

      <div class="workbench-right">
        <el-card shadow="never">
          <template #header>
            <div class="workbench-header">
              <span>入库明细（{{ workbenchItems.length }} 项）</span>
              <span class="total-amount" v-if="userStore.isOwner">合计：¥{{ totalAmount }}</span>
            </div>
          </template>
          <el-table :data="workbenchItems" border size="small" v-if="workbenchItems.length > 0" max-height="500">
            <el-table-column prop="sku_code" label="SKU" width="130" />
            <el-table-column prop="product_name" label="商品" min-width="140" />
            <el-table-column label="数量" width="130" align="center">
              <template #default="{ row }">
                <div class="qty-control">
                  <el-button size="small" circle @click="changeQty(row, -1)"><el-icon><Minus /></el-icon></el-button>
                  <span class="qty-value">{{ row.quantity }}</span>
                  <el-button size="small" circle @click="changeQty(row, 1)"><el-icon><Plus /></el-icon></el-button>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="单价" width="100" align="right" v-if="userStore.isOwner">
              <template #default="{ row }">¥{{ row.unit_price }}</template>
            </el-table-column>
            <el-table-column label="小计" width="100" align="right" v-if="userStore.isOwner">
              <template #default="{ row }">¥{{ (row.quantity * row.unit_price).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="" width="50">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="workbenchItems.splice($index, 1)">删</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="尚未扫码，请扫描商品条码或输入SKU" :image-size="80" />
        </el-card>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="入库单详情" width="700px">
      <template v-if="currentOrder">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="单号">{{ currentOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ currentOrder.user?.real_name }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentOrder.status === 1 ? 'success' : 'warning'" size="small">{{ currentOrder.status === 1 ? '已完成' : '草稿' }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="3">{{ currentOrder.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="currentOrder.items" border size="small" style="margin-top:16px">
          <el-table-column prop="product.sku_code" label="SKU" width="130" />
          <el-table-column prop="product.product_name" label="商品名称" />
          <el-table-column prop="quantity" label="数量" width="80" align="center" />
          <el-table-column prop="unit_price" label="单价" width="100" align="right" v-if="userStore.isOwner">
            <template #default="{ row }">¥{{ row.unit_price }}</template>
          </el-table-column>
          <el-table-column prop="total_price" label="小计" width="100" align="right" v-if="userStore.isOwner">
            <template #default="{ row }">¥{{ row.total_price }}</template>
          </el-table-column>
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

const userStore = useUserStore()
const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const status = ref('')

const detailDialogVisible = ref(false)
const currentOrder = ref(null)

// 作业台相关
const workbenchMode = ref(false)
const scanInput = ref('')
const scanInputRef = ref(null)
const workbenchItems = ref([])
const workbenchRemark = ref('')
const scanHistory = ref([])
const productList = ref([])
const feedback = reactive({ type: '', title: '等待扫码', desc: '请扫描商品条码或在输入框中输入SKU编码后按回车' })

const totalAmount = computed(() => workbenchItems.value.reduce((s, i) => s + i.quantity * i.unit_price, 0).toFixed(2))

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/inbound-orders', { params: { page: page.value, page_size: pageSize.value, status: status.value } })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

const fetchProducts = async () => {
  const res = await request.get('/products', { params: { page_size: 200, status: 1 } })
  productList.value = res.data.items
}

const startWorkbench = async () => {
  await fetchProducts()
  workbenchItems.value = []
  workbenchRemark.value = ''
  scanHistory.value = []
  scanInput.value = ''
  feedback.type = ''
  feedback.title = '等待扫码'
  feedback.desc = '请扫描商品条码或在输入框中输入SKU编码后按回车'
  workbenchMode.value = true
  await nextTick()
  scanInputRef.value?.focus()
}

const exitWorkbench = () => {
  workbenchMode.value = false
  fetchData()
}

const handleScan = () => {
  const sku = scanInput.value.trim()
  if (!sku) return
  // 优先按 sku_code 匹配，其次按 barcode 匹配
  let product = productList.value.find(p => p.sku_code.toUpperCase() === sku.toUpperCase())
  if (!product) {
    product = productList.value.find(p => p.barcode && p.barcode.toUpperCase() === sku.toUpperCase())
  }
  if (!product) {
    feedback.type = 'error'
    feedback.title = '未识别商品'
    feedback.desc = `编码 "${sku}" 未找到，请检查或先建档`
    ElMessage.warning(`未识别商品：${sku}`)
    scanInput.value = ''
    scanInputRef.value?.focus()
    return
  }
  // 同SKU自动累加
  const existing = workbenchItems.value.find(i => i.product_id === product.id)
  if (existing) {
    existing.quantity += 1
  } else {
    workbenchItems.value.push({
      product_id: product.id,
      sku_code: product.sku_code,
      product_name: product.product_name,
      quantity: 1,
      unit_price: product.cost_price || 0,
    })
  }
  scanHistory.value.push(product.sku_code)
  feedback.type = 'success'
  feedback.title = `已添加：${product.product_name}`
  feedback.desc = `SKU ${product.sku_code}，当前本单数量 ${existing ? existing.quantity : 1}`
  scanInput.value = ''
  scanInputRef.value?.focus()
}

const demoScan = () => {
  if (productList.value.length === 0) return
  const p = productList.value[Math.floor(Math.random() * productList.value.length)]
  scanInput.value = p.sku_code
  handleScan()
}

const undoScan = () => {
  const lastSku = scanHistory.value.pop()
  if (!lastSku) return
  const item = workbenchItems.value.find(i => i.sku_code === lastSku)
  if (item) {
    if (item.quantity > 1) {
      item.quantity -= 1
    } else {
      const idx = workbenchItems.value.indexOf(item)
      if (idx > -1) workbenchItems.value.splice(idx, 1)
    }
  }
  feedback.type = 'info'
  feedback.title = `已撤销：${lastSku}`
  feedback.desc = '撤销了上一次扫码'
  ElMessage.info(`已撤销扫码：${lastSku}`)
}

const changeQty = (row, delta) => {
  row.quantity = Math.max(1, row.quantity + delta)
}

const confirmInbound = async () => {
  if (workbenchItems.value.length === 0) return ElMessage.warning('请先扫码添加商品')
  await ElMessageBox.confirm(`确认入库 ${workbenchItems.value.length} 种商品？`, '提示', { type: 'warning' })
  try {
    const items = workbenchItems.value.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }))
    await request.post('/inbound-orders', { items, remark: workbenchRemark.value, status: 1 })
    ElMessage.success('入库成功')
    exitWorkbench()
  } catch (e) {}
}

const viewDetail = async (row) => {
  const res = await request.get(`/inbound-orders/${row.id}`)
  currentOrder.value = res.data
  detailDialogVisible.value = true
}

const confirmOrder = async (row) => {
  await ElMessageBox.confirm('确认入库？库存将更新。', '提示', { type: 'warning' })
  try {
    await request.put(`/inbound-orders/${row.id}/confirm`)
    ElMessage.success('入库确认成功')
    fetchData()
  } catch (e) {}
}

const deleteOrder = async (row) => {
  await ElMessageBox.confirm('确认删除此入库单？', '提示', { type: 'warning' })
  try {
    await request.delete(`/inbound-orders/${row.id}`)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e) {}
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-bar { display: flex; gap: 12px; }
.workbench { display: grid; grid-template-columns: 380px 1fr; gap: 16px; }
@media (max-width: 900px) { .workbench { grid-template-columns: 1fr; } }
.workbench-header { display: flex; justify-content: space-between; align-items: center; }
.total-amount { font-weight: bold; color: #409eff; }
.scan-area { padding: 8px 0; }
.scan-box { border: 2px dashed #c0c4cc; border-radius: 8px; padding: 20px; background: #fafcff; }
.scan-title { font-weight: bold; margin-bottom: 10px; color: #303133; }
.scan-input { font-size: 16px; }
.scan-input :deep(.el-input__inner) { height: 48px; font-size: 17px; }
.scan-feedback { min-height: 60px; border-radius: 8px; padding: 12px; margin: 12px 0; background: #f5f7fa; border: 1px solid #e4e7ed; }
.scan-feedback strong { display: block; margin-bottom: 4px; }
.scan-feedback.success { background: #f0f9eb; border-color: #e1f3d8; }
.scan-feedback.success strong { color: #67c23a; }
.scan-feedback.error { background: #fef0f0; border-color: #fde2e2; }
.scan-feedback.error strong { color: #f56c6c; }
.scan-feedback.info { background: #f4f4f5; border-color: #e9e9eb; }
.scan-feedback.info strong { color: #909399; }
.scan-feedback span { color: #909399; font-size: 13px; }
.scan-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.remark-area { margin-top: 12px; }
.qty-control { display: inline-flex; align-items: center; gap: 4px; }
.qty-value { min-width: 30px; text-align: center; font-weight: bold; }
</style>
