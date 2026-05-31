<template>
  <div class="dashboard">
    <!-- KPI 卡片 -->
    <el-row :gutter="12" class="stat-row">
      <el-col :xs="12" :sm="6" v-if="userStore.isOwner">
        <el-card shadow="hover" class="stat-card big-card">
          <div class="stat-label">库存成本总值 <span class="stat-sub">资金占用</span></div>
          <div class="stat-value">¥{{ formatMoney(data.total_cost_value) }}</div>
          <div class="stat-trend" v-if="data.pending_tasks?.length">毛利率空间</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6" v-if="userStore.isOwner">
        <el-card shadow="hover" class="stat-card retail">
          <div class="stat-label">库存零售总值 <span class="stat-sub">潜在销售额</span></div>
          <div class="stat-value">¥{{ formatMoney(data.total_retail_value) }}</div>
          <div class="stat-trend">毛利空间约 ¥{{ formatMoney(data.total_retail_value - data.total_cost_value) }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-label">商品种类数</div>
          <div class="stat-value small">{{ data.product_count }}</div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card shadow="hover" class="stat-card alert-card" @click="$router.push('/stock-alerts')">
          <div class="stat-label">库存预警</div>
          <div class="stat-value small" :class="{ danger: data.alert_count > 0, warn: data.alert_count > 0 }">{{ data.alert_count }}</div>
          <div class="stat-trend" v-if="data.alert_count > 0">需尽快补货</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 分类库存结构 + 待办风险 -->
    <el-row :gutter="16" class="chart-row" v-if="userStore.isOwner">
      <el-col :xs="24" :sm="14">
        <el-card shadow="hover">
          <template #header><span class="card-title">分类库存结构</span></template>
          <div class="category-chart">
            <div v-for="(cat, idx) in data.category_stock" :key="cat.category_name" class="category-bar-item">
              <div class="category-label">{{ cat.category_name }}</div>
              <div class="category-bar-bg">
                <div class="category-bar-fill" :style="{ width: getCategoryPercent(idx) + '%', background: barColors[idx % barColors.length] }"></div>
              </div>
              <div class="category-value">{{ cat.quantity }}件 / ¥{{ formatMoney(cat.value) }}</div>
            </div>
            <el-empty v-if="!data.category_stock?.length" description="暂无数据" :image-size="60" />
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="10">
        <el-card shadow="hover" class="task-card">
          <template #header><span class="card-title">待办与风险</span></template>
          <div class="task-list" v-if="data.pending_tasks?.length">
            <div v-for="task in data.pending_tasks" :key="task.title" class="task-item" @click="handleTaskClick(task)">
              <div class="task-icon" :class="task.type">
                <el-icon v-if="task.type === 'alert'"><Warning /></el-icon>
                <el-icon v-else-if="task.type === 'audit'"><Document /></el-icon>
                <el-icon v-else><Ticket /></el-icon>
              </div>
              <div class="task-content">
                <strong>{{ task.title }}</strong>
                <span>{{ task.desc }}</span>
              </div>
              <el-icon class="task-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
          <el-empty v-else description="暂无待办" :image-size="60" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 库存健康排行 -->
    <el-card shadow="hover" class="health-card" v-if="userStore.isOwner && data.health_ranking?.length">
      <template #header><span class="card-title">库存健康排行（低库存 Top5）</span></template>
      <div class="health-list">
        <div v-for="item in data.health_ranking" :key="item.sku_code" class="health-item">
          <div class="health-info">
            <span class="health-name">{{ item.product_name }}</span>
            <div class="health-bar">
              <div class="health-bar-bg"><div class="health-bar-fill" :style="{ width: item.health_percent + '%' }" :class="getHealthClass(item.health_percent)"></div></div>
            </div>
          </div>
          <div class="health-value" :class="getHealthClass(item.health_percent)">{{ item.current_stock }} / {{ item.alert_threshold }}</div>
        </div>
      </div>
    </el-card>

    <!-- 最近操作 -->
    <el-card v-if="userStore.isOwner" shadow="hover" class="recent-card">
      <template #header><span class="card-title">最近操作记录</span></template>
      <el-table :data="data.recent_operations" stripe size="small" v-if="data.recent_operations?.length">
        <el-table-column prop="operation_type" label="类型" width="120" />
        <el-table-column prop="operation_detail" label="详情" />
        <el-table-column prop="operator" label="操作人" width="100" />
        <el-table-column prop="created_at" label="时间" width="170" />
      </el-table>
      <el-empty v-else description="暂无操作记录" :image-size="60" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import request from '../utils/request'

const router = useRouter()
const userStore = useUserStore()
const data = ref({
  total_cost_value: 0, total_retail_value: 0, product_count: 0,
  alert_count: 0, today_inbound_quantity: 0, pending_audit_count: 0, recent_operations: [],
  category_stock: [], health_ranking: [], pending_tasks: [],
})

const barColors = ['#2563eb', '#14b8a6', '#f59e0b', '#e5484d', '#8b5cf6']

const formatMoney = (val) => (val || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const getCategoryPercent = (idx) => {
  const stocks = data.value.category_stock || []
  if (!stocks.length) return 0
  const max = Math.max(...stocks.map(s => s.quantity))
  return max > 0 ? Math.round(stocks[idx].quantity / max * 100) : 0
}

const getHealthClass = (percent) => {
  if (percent < 30) return 'danger'
  if (percent < 70) return 'warn'
  return 'success'
}

const handleTaskClick = (task) => {
  if (task.type === 'alert') router.push('/stock-alerts')
  else if (task.type === 'audit') router.push('/inventory-orders')
  else router.push('/products')
}

const fetchData = async () => {
  try {
    const res = await request.get('/dashboard')
    data.value = res.data
  } catch (e) {}
}

onMounted(fetchData)
</script>

<style scoped>
.dashboard { padding: 4px; }
.stat-row { margin-bottom: 16px; }
.stat-card { text-align: center; padding: 10px 0; cursor: default; transition: transform 0.2s; }
.stat-card:hover { transform: translateY(-2px); }
.stat-card.alert-card { cursor: pointer; }
.stat-label { color: #909399; font-size: 14px; margin-bottom: 8px; }
.stat-sub { font-size: 12px; color: #c0c4cc; margin-left: 4px; }
.stat-value { font-size: 28px; font-weight: bold; color: #409eff; }
.stat-value.small { font-size: 32px; }
.stat-value.warn { color: #e6a23c; }
.stat-value.danger { color: #f56c6c; }
.stat-trend { font-size: 12px; color: #909399; margin-top: 6px; }
.big-card { background: linear-gradient(135deg, #667eea22, #764ba222); }
.retail { background: linear-gradient(135deg, #f093fb22, #f5576c22); }
.chart-row { margin-bottom: 16px; }
.card-title { font-weight: bold; font-size: 15px; }
.category-chart { display: flex; flex-direction: column; gap: 12px; }
.category-bar-item { display: flex; align-items: center; gap: 12px; }
.category-label { width: 80px; text-align: right; font-size: 13px; color: #606266; }
.category-bar-bg { flex: 1; height: 20px; background: #f0f2f5; border-radius: 10px; overflow: hidden; }
.category-bar-fill { height: 100%; border-radius: 10px; transition: width 0.6s; }
.category-value { width: 140px; font-size: 12px; color: #909399; }
.task-card { height: 100%; }
.task-list { display: flex; flex-direction: column; gap: 10px; }
.task-item { display: flex; align-items: center; gap: 12px; padding: 10px; border: 1px solid #ebeef5; border-radius: 8px; cursor: pointer; transition: background 0.2s; }
.task-item:hover { background: #f5f7fa; }
.task-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.task-icon.alert { background: #fef0f0; color: #f56c6c; }
.task-icon.audit { background: #fdf6ec; color: #e6a23c; }
.task-icon.qrcode { background: #f0f9eb; color: #67c23a; }
.task-content { flex: 1; }
.task-content strong { display: block; font-size: 13px; }
.task-content span { font-size: 12px; color: #909399; }
.task-arrow { color: #c0c4cc; }
.health-card { margin-bottom: 16px; }
.health-list { display: flex; flex-direction: column; gap: 12px; }
.health-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.health-info { flex: 1; }
.health-name { font-size: 13px; font-weight: 500; }
.health-bar { margin-top: 4px; }
.health-bar-bg { height: 8px; background: #f0f2f5; border-radius: 4px; overflow: hidden; }
.health-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s; }
.health-bar-fill.danger { background: #f56c6c; }
.health-bar-fill.warn { background: #e6a23c; }
.health-bar-fill.success { background: #67c23a; }
.health-value { font-weight: bold; font-size: 14px; min-width: 80px; text-align: right; }
.health-value.danger { color: #f56c6c; }
.health-value.warn { color: #e6a23c; }
.health-value.success { color: #67c23a; }
.recent-card { margin-top: 0; }
</style>
