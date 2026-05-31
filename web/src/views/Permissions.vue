<template>
  <div class="page-container">
    <el-row :gutter="16">
      <!-- 用户管理 -->
      <el-col :span="14">
        <el-card shadow="never">
          <template #header><span class="card-title">用户管理</span></template>
          <div style="margin-bottom:12px">
            <el-button type="primary" size="small" @click="openUserDialog()">
              <el-icon><Plus /></el-icon>新增用户
            </el-button>
          </div>
          <el-table :data="users" stripe size="small">
            <el-table-column prop="username" label="用户名" width="120" />
            <el-table-column prop="real_name" label="姓名" width="100" />
            <el-table-column prop="role.role_name" label="角色" width="80" />
            <el-table-column prop="phone" label="手机号" width="130" />
            <el-table-column prop="status" label="状态" width="70" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openUserDialog(row)">编辑</el-button>
                <el-button link :type="row.status === 1 ? 'danger' : 'success'" size="small" @click="toggleUserStatus(row)">
                  {{ row.status === 1 ? '禁用' : '启用' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <!-- 角色管理 -->
      <el-col :span="10">
        <el-card shadow="never">
          <template #header><span class="card-title">角色权限</span></template>
          <el-table :data="roles" stripe size="small">
            <el-table-column prop="role_name" label="角色名称" />
            <el-table-column prop="description" label="描述" show-overflow-tooltip />
            <el-table-column label="操作" width="60">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openRoleDialog(row)">编辑</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 用户弹窗 -->
    <el-dialog v-model="userDialogVisible" :title="editingUserId ? '编辑用户' : '新增用户'" width="450px">
      <el-form ref="userFormRef" :model="userForm" :rules="userRules" label-width="80px">
        <el-form-item label="用户名" prop="username" v-if="!editingUserId">
          <el-input v-model="userForm.username" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="!editingUserId">
          <el-input v-model="userForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="姓名" prop="real_name">
          <el-input v-model="userForm.real_name" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="userForm.phone" />
        </el-form-item>
        <el-form-item label="角色" prop="role_id">
          <el-select v-model="userForm.role_id" style="width:100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.role_name" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">确认</el-button>
      </template>
    </el-dialog>

    <!-- 角色弹窗 -->
    <el-dialog v-model="roleDialogVisible" title="编辑角色权限" width="500px">
      <el-form :model="roleForm" label-width="80px">
        <el-form-item label="角色名称">{{ roleForm.role_name }}</el-form-item>
        <el-form-item label="权限设置">
          <el-checkbox-group v-model="permissionKeys">
            <el-checkbox v-for="p in permissionList" :key="p.key" :value="p.key">{{ p.label }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import request from '../utils/request'
import { ElMessage } from 'element-plus'

const users = ref([])
const roles = ref([])
const userDialogVisible = ref(false)
const roleDialogVisible = ref(false)
const editingUserId = ref(null)
const userFormRef = ref(null)
const userForm = reactive({ username: '', password: '', real_name: '', phone: '', role_id: 2 })
const userRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }, { min: 6, message: '至少6个字符', trigger: 'blur' }],
  real_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}

const roleForm = reactive({ id: null, role_name: '', permissions: {} })
const permissionKeys = ref([])
const permissionList = [
  { key: 'product_manage', label: '商品管理' },
  { key: 'inbound_manage', label: '入库管理' },
  { key: 'inventory_manage', label: '盘点管理' },
  { key: 'inventory_audit', label: '盘点审核' },
  { key: 'stock_query', label: '库存查询' },
  { key: 'stock_value_query', label: '库存价值' },
  { key: 'analytics_query', label: '数据分析' },
  { key: 'alert_manage', label: '预警管理' },
  { key: 'log_query', label: '日志查询' },
  { key: 'permission_manage', label: '权限管理' },
]

const fetchUsers = async () => {
  const res = await request.get('/users', { params: { page_size: 100 } })
  users.value = res.data.items
}

const fetchRoles = async () => {
  const res = await request.get('/roles')
  roles.value = res.data
}

const openUserDialog = (row) => {
  editingUserId.value = row?.id || null
  if (row) {
    Object.assign(userForm, { username: row.username, password: '', real_name: row.real_name, phone: row.phone, role_id: row.role_id })
  } else {
    Object.assign(userForm, { username: '', password: '', real_name: '', phone: '', role_id: 2 })
  }
  userDialogVisible.value = true
}

const saveUser = async () => {
  const valid = await userFormRef.value.validate().catch(() => false)
  if (!valid) return
  try {
    if (editingUserId.value) {
      await request.put(`/users/${editingUserId.value}`, userForm)
    } else {
      await request.post('/users', userForm)
    }
    ElMessage.success('保存成功')
    userDialogVisible.value = false
    fetchUsers()
  } catch (e) {}
}

const toggleUserStatus = async (row) => {
  await request.delete(`/users/${row.id}`)
  ElMessage.success(row.status === 1 ? '已禁用' : '已启用')
  fetchUsers()
}

const openRoleDialog = (row) => {
  roleForm.id = row.id
  roleForm.role_name = row.role_name
  const perms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions
  permissionKeys.value = Object.keys(perms).filter(k => perms[k])
  roleDialogVisible.value = true
}

const saveRole = async () => {
  const permissions = {}
  permissionList.forEach(p => { permissions[p.key] = permissionKeys.value.includes(p.key) })
  await request.put(`/roles/${roleForm.id}`, { permissions })
  ElMessage.success('权限更新成功')
  roleDialogVisible.value = false
  fetchRoles()
}

onMounted(() => { fetchUsers(); fetchRoles() })
</script>

<style scoped>
.card-title { font-weight: bold; font-size: 16px; }
</style>
