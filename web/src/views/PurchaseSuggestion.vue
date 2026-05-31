<template>
  <div class="page-container">
    <el-card shadow="never">
      <div class="page-header">
        <span style="font-size:16px;font-weight:bold">进货建议</span>
      </div>
      <el-alert type="info" :closable="false" style="margin-bottom:16px">
        以下商品库存低于预警阈值，建议及时补货。
      </el-alert>
      <el-table :data="list" stripe v-loading="loading">
        <el-table-column prop="sku_code" label="SKU编码" width="130" />
        <el-table-column prop="product_name" label="商品名称" min-width="160" />
        <el-table-column prop="category.category_name" label="分类" width="100" />
        <el-table-column prop="cost_price" label="成本价" width="100" align="right">
          <template #default="{ row }">¥{{ row.cost_price }}</template>
        </el-table-column>
        <el-table-column prop="stock_quantity" label="当前库存" width="100" align="center">
          <template #default="{ row }">
            <span style="color:#f56c6c;font-weight:bold">{{ row.stock_quantity }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="alert_threshold" label="预警阈值" width="100" align="center" />
        <el-table-column label="建议补货量" width="120" align="center">
          <template #default="{ row }">
            <span style="color:#e6a23c;font-weight:bold">{{ Math.max(row.alert_threshold - row.stock_quantity, row.alert_threshold) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="建议补货金额" width="130" align="right">
          <template #default="{ row }">
            ¥{{ (Math.max(row.alert_threshold - row.stock_quantity, row.alert_threshold) * row.cost_price).toFixed(2) }}
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无需要补货的商品" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../utils/request'

const loading = ref(false)
const list = ref([])

const fetchData = async () => {
  loading.value = true
  try {
    const res = await request.get('/stock-alerts', { params: { page_size: 100 } })
    list.value = res.data.items
  } finally { loading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
</style>
