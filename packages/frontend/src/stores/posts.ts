import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PostWithRelations, PaginatedResponse } from '@yamix/shared'
import { api } from '../api/client'

export const usePostsStore = defineStore('posts', () => {
  // State
  const posts = ref<PostWithRelations[]>([])
  const currentPost = ref<PostWithRelations | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  })

  // Actions
  async function fetchPosts(params?: {
    page?: number
    limit?: number
    categoryId?: number
    tag?: string
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<PaginatedResponse<PostWithRelations>>('/api/posts', {
        params,
      })

      posts.value = response.items
      pagination.value = {
        total: response.total,
        page: response.page,
        limit: response.limit,
        totalPages: response.totalPages,
      }
    } catch (err: any) {
      error.value = err.response?.data?.error || '投稿の取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function fetchPostById(id: number) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<PostWithRelations>(`/api/posts/${id}`)
      currentPost.value = response
    } catch (err: any) {
      error.value = err.response?.data?.error || '投稿が見つかりませんでした'
    } finally {
      loading.value = false
    }
  }

  async function createPost(data: {
    title: string
    content: string
    thumbnailUrl?: string
    categoryId: number
    tags?: string[]
    isAnonymous: boolean
    status: 'draft' | 'published'
  }) {
    loading.value = true
    error.value = null

    try {
      const { token } = useAuthStore()
      if (!token) throw new Error('認証が必要です')

      await api.post('/api/posts', data, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      return true
    } catch (err: any) {
      error.value = err.response?.data?.error || '投稿の作成に失敗しました'
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    posts,
    currentPost,
    loading,
    error,
    pagination,
    fetchPosts,
    fetchPostById,
    createPost,
  }
})

function useAuthStore() {
  // Avoid circular dependency
  const token = localStorage.getItem('token')
  return { token }
}
