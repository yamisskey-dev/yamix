import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Wallet, PostWithRelations, PaginatedPostsResponse } from '@yamix/shared'
import { api } from '../api/client'

export const useFollowsStore = defineStore('follows', () => {
  // State
  const following = ref<Wallet[]>([])
  const timeline = ref<PostWithRelations[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  })

  // Actions
  async function follow(followerId: string, targetAddress: string) {
    loading.value = true
    error.value = null

    try {
      await api.post('/api/follows', {
        followerId,
        targetAddress,
      })
      // Refresh following list
      await fetchFollowing(followerId)
      return true
    } catch (err: any) {
      error.value = err.message || '注目に失敗しました'
      return false
    } finally {
      loading.value = false
    }
  }

  async function unfollow(followerId: string, targetAddress: string) {
    loading.value = true
    error.value = null

    try {
      await api.delete('/api/follows', {
        body: {
          followerId,
          targetAddress,
        },
      })
      // Refresh following list
      await fetchFollowing(followerId)
      return true
    } catch (err: any) {
      error.value = err.message || '注目解除に失敗しました'
      return false
    } finally {
      loading.value = false
    }
  }

  async function fetchFollowing(walletId: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<Wallet[]>(`/api/follows/${walletId}`)
      following.value = response
    } catch (err: any) {
      error.value = err.message || '注目一覧の取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function checkFollowing(walletId: string, targetAddress: string) {
    try {
      const response = await api.get<{ following: boolean }>(
        `/api/follows/${walletId}/check/${targetAddress}`
      )
      return response.following
    } catch {
      return false
    }
  }

  async function fetchTimeline(walletId: string, params?: { page?: number; limit?: number }) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<PaginatedPostsResponse>(
        `/api/follows/${walletId}/timeline`,
        { params }
      )
      timeline.value = response.posts
      pagination.value = {
        total: response.total,
        page: response.page,
        limit: response.limit,
        totalPages: response.totalPages,
      }
    } catch (err: any) {
      error.value = err.message || 'タイムラインの取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  function isFollowing(targetAddress: string) {
    return following.value.some(w => w.address === targetAddress)
  }

  return {
    following,
    timeline,
    loading,
    error,
    pagination,
    follow,
    unfollow,
    fetchFollowing,
    checkFollowing,
    fetchTimeline,
    isFollowing,
  }
})
