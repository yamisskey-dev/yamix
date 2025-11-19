<template>
  <div class="min-h-screen">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-bold text-primary">Yamix</h1>
          <nav class="flex gap-4 items-center">
            <RouterLink to="/" class="text-gray-700 hover:text-primary">ホーム</RouterLink>
            <RouterLink to="/posts/new" class="btn-primary" v-if="authStore.isAuthenticated">投稿する</RouterLink>
            <template v-if="authStore.isAuthenticated">
              <span class="text-sm text-gray-600">{{ authStore.user?.displayName }}</span>
              <button @click="authStore.logout" class="btn-secondary text-sm">ログアウト</button>
            </template>
            <template v-else>
              <RouterLink to="/login" class="btn-secondary text-sm">ログイン</RouterLink>
              <RouterLink to="/register" class="btn-primary text-sm">会員登録</RouterLink>
            </template>
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
          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              タイトル <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.title"
              type="text"
              required
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="投稿のタイトルを入力"
            />
          </div>

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
              <option value="1">コラム</option>
              <option value="2">体験談</option>
              <option value="3">その他</option>
            </select>
          </div>

          <!-- Tags -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              タグ
            </label>
            <input
              v-model="tagsInput"
              type="text"
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="タグをスペース区切りで入力 (例: メンタルヘルス 希死念慮)"
            />
            <p class="text-sm text-gray-500 mt-1">スペースで区切って複数のタグを入力できます</p>
          </div>

          <!-- Thumbnail URL -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              サムネイル画像URL
            </label>
            <input
              v-model="form.thumbnailUrl"
              type="url"
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="https://example.com/image.jpg"
            />
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

          <!-- Options -->
          <div class="space-y-3">
            <label class="flex items-center gap-2">
              <input
                v-model="form.isAnonymous"
                type="checkbox"
                class="w-4 h-4 text-primary focus:ring-primary"
              />
              <span class="text-sm text-gray-700">匿名で投稿する</span>
            </label>
          </div>

          <!-- Actions -->
          <div class="flex gap-4">
            <button
              type="submit"
              :disabled="postsStore.loading"
              class="btn-primary flex-1"
              @click="form.status = 'published'"
            >
              {{ postsStore.loading ? '投稿中...' : '投稿する' }}
            </button>
            <button
              type="submit"
              :disabled="postsStore.loading"
              class="btn-secondary flex-1"
              @click="form.status = 'draft'"
            >
              下書き保存
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
import { useAuthStore } from '../stores/auth'
import { usePostsStore } from '../stores/posts'

const router = useRouter()
const authStore = useAuthStore()
const postsStore = usePostsStore()

const form = ref({
  title: '',
  content: '',
  thumbnailUrl: '',
  categoryId: '',
  isAnonymous: false,
  status: 'published' as 'draft' | 'published',
})

const tagsInput = ref('')

onMounted(async () => {
  await authStore.fetchUser()

  // Redirect if not authenticated
  if (!authStore.isAuthenticated) {
    router.push('/login')
  }
})

async function handleSubmit() {
  const tags = tagsInput.value
    .split(/\s+/)
    .filter(tag => tag.trim())
    .map(tag => tag.trim())

  const success = await postsStore.createPost({
    title: form.value.title,
    content: form.value.content,
    thumbnailUrl: form.value.thumbnailUrl || undefined,
    categoryId: Number(form.value.categoryId),
    tags: tags.length > 0 ? tags : undefined,
    isAnonymous: form.value.isAnonymous,
    status: form.value.status,
  })

  if (success) {
    router.push('/')
  }
}
</script>
