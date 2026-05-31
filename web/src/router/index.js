import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('../views/Dashboard.vue'), meta: { title: '经营驾驶舱' } },
      { path: 'products', name: 'Products', component: () => import('../views/Products.vue'), meta: { title: '商品档案' } },
      { path: 'inbound-orders', name: 'InboundOrders', component: () => import('../views/InboundOrders.vue'), meta: { title: '扫码入库' } },
      { path: 'inventory-orders', name: 'InventoryOrders', component: () => import('../views/InventoryOrders.vue'), meta: { title: '扫码盘点' } },
      { path: 'stock-query', name: 'StockQuery', component: () => import('../views/StockQuery.vue'), meta: { title: '库存查询' } },
      { path: 'stock-alerts', name: 'StockAlerts', component: () => import('../views/StockAlerts.vue'), meta: { title: '预警与补货' } },
      { path: 'purchase-suggestion', name: 'PurchaseSuggestion', component: () => import('../views/PurchaseSuggestion.vue'), meta: { title: '进货建议' } },
      { path: 'operation-logs', name: 'OperationLogs', component: () => import('../views/OperationLogs.vue'), meta: { title: '操作日志' } },
      { path: 'permissions', name: 'Permissions', component: () => import('../views/Permissions.vue'), meta: { title: '权限管理' } },
      { path: 'notifications', name: 'Notifications', component: () => import('../views/Notifications.vue'), meta: { title: '消息通知' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
