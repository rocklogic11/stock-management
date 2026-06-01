import { defineStore } from 'pinia'
import request from '../utils/request'

function parseJsonSafely(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch (e) {
    return fallback
  }
}

function normalizePermissions(value) {
  if (!value) return {}
  if (typeof value === 'string') return parseJsonSafely(value, {})
  return value
}

function extractPermissions(user) {
  if (!user) return {}
  if (user.permissions) return normalizePermissions(user.permissions)
  if (user.role?.permissions) return normalizePermissions(user.role.permissions)
  return {}
}

const storedUser = parseJsonSafely(localStorage.getItem('user'), null)

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: storedUser,
    permissions: extractPermissions(storedUser),
  }),
  getters: {
    isOwner: (state) => state.permissions?.permission_manage === true,
    hasPermission: (state) => (key) => {
      if (state.permissions?.permission_manage) return true
      return !!state.permissions?.[key]
    },
  },
  actions: {
    async login(username, password) {
      const res = await request.post('/auth/login', { username, password })
      this.token = res.data.token
      this.user = res.data.user
      this.permissions = extractPermissions(res.data.user)
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    },
    async fetchUserInfo() {
      const res = await request.get('/auth/me')
      this.user = res.data
      this.permissions = extractPermissions(res.data)
      localStorage.setItem('user', JSON.stringify(res.data))
    },
    logout() {
      this.token = ''
      this.user = null
      this.permissions = {}
      localStorage.removeItem('token')
      localStorage.removeItem('refresh_token')
      localStorage.removeItem('user')
    },
  },
})
