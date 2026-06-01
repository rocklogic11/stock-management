<template>
  <div class="page-container">
    <!-- 盘点单列表 -->
    <el-card shadow="never" v-if="!workbenchMode">
      <div class="page-header">
        <div class="search-bar">
          <el-select v-model="status" placeholder="状态" clearable style="width:120px" @change="fetchData">
            <el-option label="盘点中" :value="1" /><el-option label="待审核" :value="2" /><el-option label="已完成" :value="3" />
          </el-select>
        </div>
        <el-button type="primary" @click="openCreateDialog" v-if="userStore.hasPermission('inventory_manage')">
          <el-icon><Plus /></el-icon>新建盘点单
        </el-button>
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="order_no" label="单号" width="180" />
        <el-table-column prop="user.real_name" label="盘点人" width="100" />
        <el-table-column prop="inventory_type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ row.inventory_type === 1 ? '临时盘点' : '定期盘点' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total_quantity" label="商品数" width="80" align="center" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="audit_status" label="审核" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.audit_status === 1" type="success" size="small">通过</el-tag>
            <el-tag v-else-if="row.audit_status === 2" type="danger" size="small">驳回</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="170" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewDetail(row)">详情</el-button>
            <el-button link type="success" size="small" @click="startWorkbench(row)" v-if="row.status === 1 && userStore.hasPermission('inventory_manage')">扫码盘点</el-button>
            <el-button link type="warning" size="small" @click="submitOrder(row)" v-if="row.status === 1">提交审核</el-button>
            <el-button link type="primary" size="small" @click="openAuditDialog(row)" v-if="row.status === 2 && userStore.hasPermission('inventory_audit')">审核</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        layout="total, prev, pager, next" @current-change="fetchData" style="margin-top:16px; justify-content:flex-end" />
    </el-card>

    <!-- 盘点作业台 -->
    <div v-if="workbenchMode" class="workbench">
      <!-- 进度卡片 -->
      <div class="progress-cards">
        <el-card shadow="never" class="progress-card">
          <div class="progress-label">应盘商品</div>
          <div class="progress-value">{{ checkItems.length }}</div>
        </el-card>
        <el-card shadow="never" class="progress-card">
          <div class="progress-label">已盘</div>
          <div class="progress-value success">{{ checkedCount }}</div>
        </el-card>
        <el-card shadow="never" class="progress-card">
          <div class="progress-label">差异商品</div>
          <div class="progress-value danger">{{ diffCount }}</div>
        </el-card>
        <el-card shadow="never" class="progress-card">
          <div class="progress-label">完成度</div>
          <div class="progress-value">{{ checkItems.length > 0 ? Math.round(checkedCount / checkItems.length * 100) : 0 }}%</div>
        </el-card>
      </div>

      <div class="workbench-body">
        <div class="workbench-left">
          <el-card shadow="never">
            <template #header>
              <div class="workbench-header">
                <span>扫码盘点</span>
                <el-button text @click="exitWorkbench">返回列表</el-button>
              </div>
            </template>
            <div class="scan-box">
              <div class="scan-title">扫描或输入 SKU</div>
              <el-input
                ref="scanInputRef"
                v-model="scanInput"
                placeholder="扫描条码或输入SKU，回车盘点"
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
                <el-button type="primary" @click="saveAndSubmit" :disabled="checkedCount === 0">保存并提交</el-button>
              </div>
            </div>
          </el-card>
        </div>

        <div class="workbench-right">
          <el-card shadow="never">
            <template #header>
              <span>盘点明细</span>
            </template>
            <el-table :data="checkItems" border size="small" max-height="480">
              <el-table-column prop="product.sku_code" label="SKU" width="120" />
              <el-table-column prop="product.product_name" label="商品" min-width="120" />
              <el-table-column prop="system_quantity" label="系统数" width="80" align="center" />
              <el-table-column label="实盘数" width="100" align="center">
                <template #default="{ row }">
                  <span v-if="row.actual_quantity !== null" :class="{ diff: row.difference !== 0 }">{{ row.actual_quantity }}</span>
                  <span v-else class="pending">未盘</span>
                </template>
              </el-table-column>
              <el-table-column label="差异" width="80" align="center">
                <template #default="{ row }">
                  <span v-if="row.difference !== null" :style="{ color: row.difference > 0 ? '#67c23a' : row.difference < 0 ? '#f56c6c' : '', fontWeight: 'bold' }">
                    {{ row.difference > 0 ? '+' : '' }}{{ row.difference }}
                  </span>
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ row }">
                  <el-button link size="small" @click="manualCheck(row)">手动录入</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>
      </div>
    </div>

    <!-- 新建盘点单弹窗 -->
    <el-dialog v-model="createDialogVisible" title="新建盘点单" width="500px">
      <el-form :model="createForm" label-width="80px">
        <el-form-item label="盘点类型">
          <el-radio-group v-model="createForm.inventory_type">
            <el-radio :value="1">临时盘点</el-radio>
            <el-radio :value="2">定期盘点</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="盘点范围">
          <el-select v-model="createForm.inventory_scope" multiple placeholder="选择分类（空=全盘）" style="width:100%">
            <el-option v-for="c in categories" :key="c.id" :label="c.category_name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建并开始盘点</el-button>
      </template>
    </el-dialog>

    <!-- 手动录入弹窗 -->
    <el-dialog v-model="manualDialogVisible" title="手动录入实盘数量" width="350px">
      <el-form label-width="80px" v-if="manualItem">
        <el-form-item label="商品">{{ manualItem.product?.product_name }}</el-form-item>
        <el-form-item label="系统数量">{{ manualItem.system_quantity }}</el-form-item>
        <el-form-item label="实盘数量">
          <el-input-number v-model="manualQty" :min="0" size="large" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveManualCheck">确认</el-button>
      </template>
    </el-dialog>

    <!-- 审核弹窗 -->
    <el-dialog v-model="auditDialogVisible" title="盘点审核" width="500px">
      <template v-if="auditOrder">
        <el-descriptions :column="2" border size="small" style="margin-bottom:16px">
          <el-descriptions-item label="单号">{{ auditOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="盘点人">{{ auditOrder.user?.real_name }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="auditOrder.items" border size="small" style="margin-bottom:16px">
          <el-table-column prop="product.product_name" label="商品" />
          <el-table-column prop="system_quantity" label="系统数量" width="90" align="center" />
          <el-table-column prop="actual_quantity" label="实际数量" width="90" align="center" />
          <el-table-column label="差异" width="80" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.difference > 0 ? '#67c23a' : row.difference < 0 ? '#f56c6c' : '' }">{{ row.difference }}</span>
            </template>
          </el-table-column>
        </el-table>
        <el-input v-model="auditOpinion" placeholder="审核意见（可选）" />
      </template>
      <template #footer>
        <el-button @click="auditDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="doAudit(2)">驳回</el-button>
        <el-button type="success" @click="doAudit(1)">通过</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="盘点单详情" width="700px">
      <template v-if="currentOrder">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="单号">{{ currentOrder.order_no }}</el-descriptions-item>
          <el-descriptions-item label="盘点人">{{ currentOrder.user?.real_name }}</el-descriptions-item>
          <el-descriptions-item label="审核人">{{ currentOrder.auditUser?.real_name || '-' }}</el-descriptions-item>
        </el-descriptions>
        <el-table :data="currentOrder.items" border size="small" style="margin-top:16px">
          <el-table-column prop="product.sku_code" label="SKU" width="130" />
          <el-table-column prop="product.product_name" label="商品名称" />
          <el-table-column prop="system_quantity" label="系统数量" width="90" align="center" />
          <el-table-column prop="actual_quantity" label="实际数量" width="90" align="center" />
          <el-table-column label="差异" width="80" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.difference > 0 ? '#67c23a' : row.difference < 0 ? '#f56c6c' : '' }">{{ row.difference ?? '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="差异金额" width="100" align="right" v-if="userStore.isOwner">
            <template #default="{ row }">¥{{ row.difference_amount || 0 }}</template>
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
const categories = ref([])

const createDialogVisible = ref(false)
const auditDialogVisible = ref(false)
const detailDialogVisible = ref(false)
const currentOrder = ref(null)
const auditOrder = ref(null)
const auditOpinion = ref('')
const createForm = reactive({ inventory_type: 1, inventory_scope: [], remark: '' })

// 作业台相关
const workbenchMode = ref(false)
const scanInput = ref('')
const scanInputRef = ref(null)
const checkItems = ref([])
const checkOrderId = ref(null)
const feedback = reactive({ type: '', title: '等待扫码', desc: '请扫描商品条码或在输入框中输入SKU编码后按回车' })

// 手动录入
const manualDialogVisible = ref(false)
const manualItem = ref(null)
const manualQty = ref(0)

const statusType = (s) => ({ 1: 'info', 2: 'warning', 3: 'success' }[s] || '')
const statusText = (s) => ({ 1: '盘点中', 2: '待审核', 3: '已完成' }[s] || '')

const checkedCount = computed(() => checkItems.value.filter(i => i.actual_quantity !== null).length)
const diffCount = computed(() => checkItems.value.filter(i => i.difference !== null && i.difference !== 0).length)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/inventory-orders', { params: { page: page.value, page_size: pageSize.value, status: status.value } })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

const fetchCategories = async () => {
  const res = await request.get('/categories')
  categories.value = Array.isArray(res.data) ? res.data : []
}

const openCreateDialog = () => {
  Object.assign(createForm, { inventory_type: 1, inventory_scope: [], remark: '' })
  createDialogVisible.value = true
  fetchCategories()
}

const submitCreate = async () => {
  try {
    const scope = createForm.inventory_scope?.length ? createForm.inventory_scope.join(',') : undefined
    const res = await request.post('/inventory-orders', { ...createForm, inventory_scope: scope })
    createDialogVisible.value = false
    ElMessage.success('盘点单创建成功')
    // 直接进入作业台
    startWorkbench({ id: res.data.id })
  } catch (e) {}
}

const startWorkbench = async (row) => {
  const res = await request.get(`/inventory-orders/${row.id}`)
  checkItems.value = res.data.items.map(i => ({ ...i.toJSON ? i.toJSON() : i }))
  checkOrderId.value = row.id
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

const handleScan = async () => {
  const sku = scanInput.value.trim()
  if (!sku) return
  try {
    const res = await request.post(`/inventory-orders/${checkOrderId.value}/scan`, { sku_code: sku })
    // 更新本地数据
    const idx = checkItems.value.findIndex(i => i.product_id === res.data.product_id)
    if (idx > -1) {
      checkItems.value[idx].actual_quantity = res.data.scanned_quantity
      checkItems.value[idx].difference = res.data.difference
    }
    feedback.type = 'success'
    feedback.title = `已盘点：${res.data.product_name}`
    feedback.desc = `系统 ${res.data.system_quantity}，实盘 ${res.data.scanned_quantity}，差异 ${res.data.difference > 0 ? '+' : ''}${res.data.difference}`
  } catch (e) {
    feedback.type = 'error'
    feedback.title = '未识别商品'
    feedback.desc = `SKU "${sku}" 未找到`
  }
  scanInput.value = ''
  scanInputRef.value?.focus()
}

const demoScan = () => {
  const unchecked = checkItems.value.filter(i => i.actual_quantity === null)
  const target = unchecked.length > 0 ? unchecked[0] : checkItems.value[0]
  if (target && target.product) {
    scanInput.value = target.product.sku_code
    handleScan()
  }
}

const manualCheck = (row) => {
  manualItem.value = row
  manualQty.value = row.actual_quantity || row.system_quantity
  manualDialogVisible.value = true
}

const saveManualCheck = async () => {
  try {
    await request.put(`/inventory-orders/${checkOrderId.value}/item`, {
      product_id: manualItem.value.product_id,
      actual_quantity: manualQty.value,
    })
    const idx = checkItems.value.indexOf(manualItem.value)
    if (idx > -1) {
      checkItems.value[idx].actual_quantity = manualQty.value
      checkItems.value[idx].difference = manualQty.value - checkItems.value[idx].system_quantity
    }
    manualDialogVisible.value = false
    ElMessage.success('录入成功')
  } catch (e) {}
}

const saveAndSubmit = async () => {
  await ElMessageBox.confirm('确认提交审核？提交后不可修改。', '提示', { type: 'warning' })
  try {
    await request.put(`/inventory-orders/${checkOrderId.value}/submit`)
    ElMessage.success('已提交审核')
    exitWorkbench()
  } catch (e) {}
}

const viewDetail = async (row) => {
  const res = await request.get(`/inventory-orders/${row.id}`)
  currentOrder.value = res.data
  detailDialogVisible.value = true
}

const submitOrder = async (row) => {
  await ElMessageBox.confirm('确认提交审核？', '提示', { type: 'warning' })
  try {
    await request.put(`/inventory-orders/${row.id}/submit`)
    ElMessage.success('已提交审核')
    fetchData()
  } catch (e) {}
}

const openAuditDialog = async (row) => {
  const res = await request.get(`/inventory-orders/${row.id}`)
  auditOrder.value = res.data
  auditOpinion.value = ''
  auditDialogVisible.value = true
}

const doAudit = async (auditStatus) => {
  try {
    await request.put(`/inventory-orders/${auditOrder.value.id}/audit`, {
      audit_status: auditStatus,
      audit_opinion: auditOpinion.value,
    })
    ElMessage.success(auditStatus === 1 ? '审核通过' : '已驳回')
    auditDialogVisible.value = false
    fetchData()
  } catch (e) {}
}

onMounted(() => { fetchData(); fetchCategories() })
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-bar { display: flex; gap: 12px; }
.progress-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
@media (max-width: 768px) { .progress-cards { grid-template-columns: repeat(2, 1fr); } }
.progress-card { text-align: center; }
.progress-label { color: #909399; font-size: 13px; margin-bottom: 6px; }
.progress-value { font-size: 28px; font-weight: bold; color: #409eff; }
.progress-value.success { color: #67c23a; }
.progress-value.danger { color: #f56c6c; }
.workbench-body { display: grid; grid-template-columns: 380px 1fr; gap: 16px; }
@media (max-width: 900px) { .workbench-body { grid-template-columns: 1fr; } }
.workbench-header { display: flex; justify-content: space-between; align-items: center; }
.scan-box { border: 2px dashed #c0c4cc; border-radius: 8px; padding: 20px; background: #fafcff; }
.scan-title { font-weight: bold; margin-bottom: 10px; color: #303133; }
.scan-input :deep(.el-input__inner) { height: 48px; font-size: 17px; }
.scan-feedback { min-height: 60px; border-radius: 8px; padding: 12px; margin: 12px 0; background: #f5f7fa; border: 1px solid #e4e7ed; }
.scan-feedback strong { display: block; margin-bottom: 4px; }
.scan-feedback.success { background: #f0f9eb; border-color: #e1f3d8; }
.scan-feedback.success strong { color: #67c23a; }
.scan-feedback.error { background: #fef0f0; border-color: #fde2e2; }
.scan-feedback.error strong { color: #f56c6c; }
.scan-feedback span { color: #909399; font-size: 13px; }
.scan-actions { display: flex; gap: 8px; }
.pending { color: #c0c4cc; font-size: 12px; }
.diff { color: #e6a23c; font-weight: bold; }
</style>
