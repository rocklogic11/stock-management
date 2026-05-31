<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="page-header">
        <div class="search-bar">
          <el-select v-model="operationType" placeholder="操作类型" clearable style="width:140px" @change="fetchData">
            <el-option v-for="t in typeList" :key="t" :label="t" :value="t" />
          </el-select>
          <el-date-picker v-model="dateRange" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期"
            value-format="YYYY-MM-DD" style="width:260px" @change="fetchData" />
        </div>
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="operation_type" label="操作类型" width="120" />
        <el-table-column prop="operation_detail" label="操作详情" min-width="250" show-overflow-tooltip />
        <el-table-column prop="user.real_name" label="操作人" width="100" />
        <el-table-column prop="created_at" label="操作时间" width="170" />
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        layout="total, prev, pager, next" @current-change="fetchData" style="margin-top:16px; justify-content:flex-end" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const operationType = ref('')
const dateRange = ref(null)
const typeList = ['商品管理', '入库管理', '盘点管理', '盘点审核', '预警管理', '用户管理', '角色管理', '分类管理', '修改密码']

const fetchData = async () => {
  loading.value = true
  try {
    const params = { page: page.value, page_size: pageSize.value, operation_type: operationType.value }
    if (dateRange.value?.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }
    const res = await request.get('/operation-logs', { params })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-bar { display: flex; gap: 12px; }
</style>
