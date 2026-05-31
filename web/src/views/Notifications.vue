<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="page-header">
        <span style="font-size:16px;font-weight:bold">消息通知</span>
        <el-button type="primary" size="small" @click="markAllRead">全部标记已读</el-button>
      </div>

      <div class="filter-bar">
        <el-select v-model="type" placeholder="通知类型" clearable style="width:140px" @change="fetchData">
          <el-option label="库存预警" :value="1" /><el-option label="盘点审核" :value="2" />
          <el-option label="审核结果" :value="3" /><el-option label="盘点提醒" :value="4" />
        </el-select>
        <el-select v-model="isRead" placeholder="是否已读" clearable style="width:120px" @change="fetchData">
          <el-option label="未读" :value="0" /><el-option label="已读" :value="1" />
        </el-select>
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="type_name" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="typeColor(row.type)" size="small">{{ row.type_name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" width="140" />
        <el-table-column prop="content" label="内容" min-width="250" show-overflow-tooltip />
        <el-table-column prop="is_read" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_read ? 'info' : 'danger'" size="small">{{ row.is_read ? '已读' : '未读' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button v-if="!row.is_read" link type="primary" size="small" @click="markRead(row)">标为已读</el-button>
            <el-button v-if="row.related_id" link type="success" size="small" @click="goToDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        layout="total, prev, pager, next" @current-change="fetchData" style="margin-top:16px; justify-content:flex-end" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../utils/request'
import { ElMessage } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const type = ref('')
const isRead = ref('')

const typeColor = (t) => ({ 1: 'danger', 2: 'warning', 3: 'success', 4: 'info' }[t] || '')

const fetchData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, page_size: pageSize.value }
    if (type.value) params.type = type.value
    if (isRead.value !== '') params.is_read = isRead.value
    const res = await request.get('/notifications', { params })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

const markRead = async (row) => {
  await request.put(`/notifications/${row.id}/read`)
  fetchData()
}

const markAllRead = async () => {
  await request.put('/notifications/read-all')
  ElMessage.success('全部标记已读')
  fetchData()
}

const goToDetail = (row) => {
  if (row.related_type === '盘点单') router.push('/inventory-orders')
  else if (row.related_type === '商品') router.push('/stock-alerts')
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.filter-bar { display: flex; gap: 12px; margin-bottom: 16px; }
</style>
