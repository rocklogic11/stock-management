import { defineStore } from 'pinia'
import request from '../utils/request'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    permissions: {},
  }),
  getters: {
    isOwner: (state) => state.user?.role === '店主',
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
      this.permissions = res.data.user.permissions || {}
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    },
    async fetchUserInfo() {
      const res = await request.get('/auth/me')
      this.user = res.data
      this.permissions = res.data.role?.permissions || {}
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
