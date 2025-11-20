import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PostWithRelations, PaginatedPostsResponse } from '@yamix/shared'
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
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<PaginatedPostsResponse>('/api/posts', {
        params,
      })

      posts.value = response.posts
      pagination.value = {
        total: response.total,
        page: response.page,
        limit: response.limit,
        totalPages: response.totalPages,
      }
    } catch (err: any) {
      error.value = err.message || '投稿の取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function fetchPostById(id: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<PostWithRelations>(`/api/posts/${id}`)
      currentPost.value = response
    } catch (err: any) {
      error.value = err.message || '投稿が見つかりませんでした'
    } finally {
      loading.value = false
    }
  }

  async function fetchPostsByWallet(address: string) {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<PostWithRelations[]>(`/api/wallets/${address}/posts`)
      posts.value = response
    } catch (err: any) {
      error.value = err.message || '投稿の取得に失敗しました'
    } finally {
      loading.value = false
    }
  }

  async function createPost(data: {
    content: string
    walletId: string
    parentId?: string
  }) {
    loading.value = true
    error.value = null

    try {
      const response = await api.post<PostWithRelations>('/api/posts', data)
      return response
    } catch (err: any) {
      error.value = err.message || '投稿の作成に失敗しました'
      return null
    } finally {
      loading.value = false
    }
  }

  async function deletePost(postId: string, walletId: string) {
    loading.value = true
    error.value = null

    try {
      await api.delete(`/api/posts/${postId}`, {
        body: { walletId },
      })
      // Remove from local state
      posts.value = posts.value.filter(p => p.id !== postId)
      if (currentPost.value?.id === postId) {
        currentPost.value = null
      }
      return true
    } catch (err: any) {
      error.value = err.message || '投稿の削除に失敗しました'
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
    fetchPostsByWallet,
    createPost,
    deletePost,
  }
})
