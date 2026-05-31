<template>
  <el-container class="layout-container">
    <!-- 侧边栏 - PC端 -->
    <el-aside v-if="!isMobile" :width="isCollapse ? '64px' : '220px'" class="layout-aside">
      <div class="logo">
        <span v-if="!isCollapse">库存预备齐</span>
        <span v-else>🏎️</span>
      </div>
      <el-menu :default-active="currentRoute" :collapse="isCollapse" router background-color="#1a2332" text-color="#bfcbd9" active-text-color="#14b8a6">
        <div class="nav-group" v-if="!isCollapse">每日工作</div>
        <el-menu-item index="/dashboard"><el-icon><DataAnalysis /></el-icon><template #title>经营驾驶舱</template></el-menu-item>
        <el-menu-item index="/inbound-orders"><el-icon><Box /></el-icon><template #title>扫码入库</template></el-menu-item>
        <el-menu-item index="/inventory-orders"><el-icon><List /></el-icon><template #title>扫码盘点</template></el-menu-item>
        <el-menu-item index="/stock-query"><el-icon><Search /></el-icon><template #title>库存查询</template></el-menu-item>
        <el-menu-item index="/stock-alerts"><el-icon><Warning /></el-icon><template #title>预警与补货</template></el-menu-item>
        <div class="nav-group" v-if="!isCollapse">基础维护</div>
        <el-menu-item index="/products"><el-icon><Goods /></el-icon><template #title>商品档案</template></el-menu-item>
        <el-sub-menu index="system-sub" v-if="userStore.isOwner"><template #title><el-icon><Setting /></el-icon><span>系统管理</span></template><el-menu-item index="/operation-logs">操作日志</el-menu-item><el-menu-item index="/permissions">权限管理</el-menu-item></el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- 侧边栏 - 移动端抽屉 -->
    <el-drawer v-model="drawerVisible" direction="ltr" size="220px" :show-close="false" :with-header="false" v-if="isMobile">
      <div class="logo">库存预备齐</div>
      <el-menu :default-active="currentRoute" router background-color="#1a2332" text-color="#bfcbd9" active-text-color="#14b8a6" @select="drawerVisible = false">
        <div class="nav-group">每日工作</div>
        <el-menu-item index="/dashboard"><el-icon><DataAnalysis /></el-icon><span>经营驾驶舱</span></el-menu-item>
        <el-menu-item index="/inbound-orders"><el-icon><Box /></el-icon><span>扫码入库</span></el-menu-item>
        <el-menu-item index="/inventory-orders"><el-icon><List /></el-icon><span>扫码盘点</span></el-menu-item>
        <el-menu-item index="/stock-query"><el-icon><Search /></el-icon><span>库存查询</span></el-menu-item>
        <el-menu-item index="/stock-alerts"><el-icon><Warning /></el-icon><span>预警与补货</span></el-menu-item>
        <div class="nav-group">基础维护</div>
        <el-menu-item index="/products"><el-icon><Goods /></el-icon><span>商品档案</span></el-menu-item>
        <el-sub-menu index="system-sub" v-if="userStore.isOwner"><template #title><el-icon><Setting /></el-icon><span>系统管理</span></template><el-menu-item index="/operation-logs">操作日志</el-menu-item><el-menu-item index="/permissions">权限管理</el-menu-item></el-sub-menu>
      </el-menu>
    </el-drawer>

    <el-container>
      <!-- 顶部导航 -->
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="isMobile ? (drawerVisible = true) : (isCollapse = !isCollapse)">
            <Fold v-if="!isCollapse && !isMobile" /><Expand v-else /><Menu v-if="isMobile" />
          </el-icon>
          <span class="header-title">{{ currentTitle }}</span>
        </div>
        <div class="header-right">
          <!-- 角色视角切换 -->
          <div class="role-tabs" v-if="userStore.isOwner">
            <button :class="['role-tab', { active: !clerkView }]" @click="clerkView = false">店主视角</button>
            <button :class="['role-tab', { active: clerkView }]" @click="clerkView = true">店员视角</button>
          </div>
          <el-badge :value="unreadCount" :hidden="unreadCount === 0" class="notification-badge">
            <el-icon class="header-icon" @click="$router.push('/notifications')"><Bell /></el-icon>
          </el-badge>
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-icon><UserFilled /></el-icon>
              <span class="user-name">{{ userStore.user?.real_name || userStore.user?.username }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="password">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>

    <!-- 修改密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="400px">
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="80px">
        <el-form-item label="旧密码" prop="old_password"><el-input v-model="pwdForm.old_password" type="password" show-password /></el-form-item>
        <el-form-item label="新密码" prop="new_password"><el-input v-model="pwdForm.new_password" type="password" show-password /></el-form-item>
        <el-form-item label="确认密码" prop="confirm_password"><el-input v-model="pwdForm.confirm_password" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import request from '../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const isCollapse = ref(false)
const isMobile = ref(window.innerWidth <= 768)
const drawerVisible = ref(false)
const unreadCount = ref(0)
const passwordDialogVisible = ref(false)
const pwdFormRef = ref(null)
const clerkView = ref(false)

const pwdForm = reactive({ old_password: '', new_password: '', confirm_password: '' })
const pwdRules = {
  old_password: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6个字符', trigger: 'blur' },
    { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: '密码需包含字母和数字', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: (rule, value, callback) => { if (value !== pwdForm.new_password) callback(new Error('两次密码不一致')); else callback() }, trigger: 'blur' },
  ],
}

const currentRoute = computed(() => route.path)
const currentTitle = computed(() => route.meta.title || '')

const onResize = () => { isMobile.value = window.innerWidth <= 768 }

const fetchUnreadCount = async () => {
  try { const res = await request.get('/notifications/unread-count'); unreadCount.value = res.data.unread_count } catch (e) {}
}

const handleCommand = (cmd) => {
  if (cmd === 'logout') {
    ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' }).then(() => { userStore.logout(); router.push('/login') }).catch(() => {})
  } else if (cmd === 'password') {
    pwdForm.old_password = ''; pwdForm.new_password = ''; pwdForm.confirm_password = ''
    passwordDialogVisible.value = true
  }
}

const changePassword = async () => {
  const valid = await pwdFormRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    await request.put(`/users/${userStore.user.id}/password`, { old_password: pwdForm.old_password, new_password: pwdForm.new_password })
    ElMessage.success('密码修改成功'); passwordDialogVisible.value = false
  } catch (e) {}
}

// 角色视角切换：通过CSS class控制敏感字段可见性
watch(clerkView, (val) => {
  document.body.classList.toggle('clerk-view', val)
  ElMessage.info(val ? '已切换为店员视角：成本与金额字段已隐藏' : '已切换为店主视角：展示经营数据')
})

let timer = null
onMounted(() => { fetchUnreadCount(); timer = setInterval(fetchUnreadCount, 60000); window.addEventListener('resize', onResize) })
onUnmounted(() => { if (timer) clearInterval(timer); window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.layout-container { height: 100vh; }
.layout-aside { background-color: #1a2332; transition: width 0.3s; overflow-x: hidden; }
.logo { height: 60px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: bold; border-bottom: 1px solid #2a3a4e; }
.layout-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e6e6e6; background: #fff; padding: 0 20px; height: 56px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.collapse-btn { font-size: 20px; cursor: pointer; }
.header-title { font-size: 16px; font-weight: 600; color: #303133; }
.header-right { display: flex; align-items: center; gap: 16px; }
.header-icon { font-size: 20px; cursor: pointer; }
.user-info { display: flex; align-items: center; gap: 4px; cursor: pointer; color: #606266; }
.notification-badge { line-height: 1; }
.el-menu { border-right: none; }
.layout-main { background: #f0f2f5; overflow-y: auto; padding: 16px; }
.nav-group { padding: 16px 20px 6px; color: #6b7d95; font-size: 15px; font-weight: 700; letter-spacing: 2px; }
.el-menu-item { font-size: 14px; }

/* 角色切换标签 */
.role-tabs { display: flex; background: #f0f2f5; border-radius: 8px; padding: 3px; gap: 2px; }
.role-tab { border: 0; background: transparent; border-radius: 6px; padding: 5px 12px; font-size: 13px; color: #909399; cursor: pointer; transition: all 0.2s; }
.role-tab.active { background: #fff; color: #303133; box-shadow: 0 1px 4px rgba(0,0,0,0.08); font-weight: 600; }

@media screen and (max-width: 768px) {
  .user-name { display: none; }
  .layout-main { padding: 8px; }
  .header-title { font-size: 14px; }
  .role-tabs { display: none; }
}
</style>

<style>
/* 店员视角全局样式：隐藏敏感字段 */
body.clerk-view .owner-only-field { display: none !important; }
</style>
