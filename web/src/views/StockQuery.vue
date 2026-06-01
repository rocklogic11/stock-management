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
      </div>

      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="sku_code" label="SKU编码" width="130" />
        <el-table-column prop="product_name" label="商品名称" min-width="160" />
        <el-table-column prop="category.category_name" label="分类" width="100" />
        <el-table-column prop="cost_price" label="成本价" width="100" align="right" v-if="userStore.isOwner">
          <template #default="{ row }">¥{{ row.cost_price }}</template>
        </el-table-column>
        <el-table-column prop="retail_price" label="零售价" width="100" align="right">
          <template #default="{ row }">¥{{ row.retail_price }}</template>
        </el-table-column>
        <el-table-column prop="stock_quantity" label="库存数量" width="100" align="center" />
        <el-table-column label="库存金额(成本)" width="130" align="right" v-if="userStore.isOwner">
          <template #default="{ row }">¥{{ (row.stock_quantity * row.cost_price).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="库存金额(零售)" width="130" align="right" v-if="userStore.isOwner">
          <template #default="{ row }">¥{{ (row.stock_quantity * row.retail_price).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="预警" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="isLowStock(row)" type="danger" size="small">低</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total"
        :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next"
        @current-change="fetchData" @size-change="fetchData" style="margin-top:16px; justify-content:flex-end" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/user'
import request from '../utils/request'

const userStore = useUserStore()
const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const categoryId = ref('')
const categories = ref([])

const isLowStock = (row) => row.alertSetting && row.stock_quantity < row.alertSetting.alert_threshold

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/products', { params: { page: page.value, page_size: pageSize.value, keyword: keyword.value, category_id: categoryId.value, status: 1 } })
    list.value = res.data.items
    total.value = res.data.total
  } finally { loading.value = false }
}

const fetchCategories = async () => {
  const res = await request.get('/categories')
  categories.value = Array.isArray(res.data) ? res.data : []
}

onMounted(() => { fetchData(); fetchCategories() })
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.search-bar { display: flex; gap: 12px; }
</style>
