import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@yamix/shared'
import { api } from '../api/client'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // Actions
  async function login(email: string, password: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.post<{ user: User; token: string }>('/api/auth/login', {
        email,
        password,
      })

      user.value = response.user
      token.value = response.token
      localStorage.setItem('token', response.token)

      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || 'ログインに失敗しました'
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(email: string, password: string, displayName: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.post<{ user: User; token: string }>('/api/auth/register', {
        email,
        password,
        displayName,
      })

      user.value = response.user
      token.value = response.token
      localStorage.setItem('token', response.token)

      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || '登録に失敗しました'
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchUser() {
    if (!token.value) return

    try {
      const response = await api.get<User>('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token.value}`,
        },
      })

      user.value = response
    } catch (err) {
      // Token is invalid, clear it
      logout()
    }
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
  }

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    fetchUser,
    logout,
  }
})
