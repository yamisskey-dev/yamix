<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold text-primary">Yamix</h1>
          <nav class="flex gap-4 items-center">
            <RouterLink to="/" class="text-gray-700 hover:text-primary">ホーム</RouterLink>
            <span v-if="walletStore.isConnected" class="text-sm text-gray-600 font-mono">
              {{ walletStore.address }}
            </span>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div class="card">
        <h1 class="text-3xl font-bold mb-6">新規投稿</h1>

        <!-- Error message -->
        <div v-if="postsStore.error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-red-700">{{ postsStore.error }}</p>
        </div>

        <form @submit.prevent="handleSubmit" class="space-y-6">
          <!-- Category -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              カテゴリー <span class="text-red-500">*</span>
            </label>
            <select
              v-model="form.categoryId"
              required
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">カテゴリーを選択</option>
              <option v-for="category in categories" :key="category.id" :value="category.id">
                {{ category.name }}
              </option>
            </select>
          </div>

          <!-- Content -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              本文 <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="form.content"
              required
              rows="15"
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="投稿の内容を入力してください..."
            ></textarea>
          </div>

          <!-- Actions -->
          <div class="flex gap-4">
            <button
              type="submit"
              :disabled="postsStore.loading"
              class="btn-primary flex-1"
            >
              {{ postsStore.loading ? '投稿中...' : '投稿する' }}
            </button>
            <RouterLink to="/" class="btn-secondary flex-1 text-center">
              キャンセル
            </RouterLink>
          </div>
        </form>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useWalletStore } from '../stores/wallet'
import { api } from '../api/client'

const router = useRouter()
const postsStore = usePostsStore()
const walletStore = useWalletStore()

interface Category {
  id: string
  name: string
  slug: string
}

const categories = ref<Category[]>([])

const form = ref({
  content: '',
  categoryId: '',
})

onMounted(async () => {
  // Ensure wallet exists
  if (!walletStore.isConnected) {
    await walletStore.createWallet()
  }

  // Fetch categories
  try {
    const response = await api.get<Category[]>('/api/categories')
    categories.value = response
  } catch (err) {
    console.error('Failed to fetch categories:', err)
  }
})

async function handleSubmit() {
  if (!walletStore.walletId) {
    await walletStore.createWallet()
  }

  const post = await postsStore.createPost({
    content: form.value.content,
    walletId: walletStore.walletId,
    categoryId: form.value.categoryId,
  })

  if (post) {
    router.push(`/posts/${post.id}`)
  }
}
</script>
