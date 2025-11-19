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
    <main class="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Posts list -->
        <div class="lg:col-span-2">
          <h2 class="text-2xl font-bold mb-6">最新記事</h2>

          <!-- Loading -->
          <div v-if="postsStore.loading" class="text-center py-12">
            <div class="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p class="mt-4 text-gray-600">読み込み中...</p>
          </div>

          <!-- Error -->
          <div v-else-if="postsStore.error" class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-red-700">{{ postsStore.error }}</p>
          </div>

          <!-- Posts -->
          <div v-else class="space-y-6">
            <article
              v-for="post in postsStore.posts"
              :key="post.id"
              class="card hover:shadow-lg transition cursor-pointer"
              @click="router.push(`/posts/${post.id}`)"
            >
              <div class="flex gap-4">
                <img
                  v-if="post.thumbnailUrl"
                  :src="post.thumbnailUrl"
                  :alt="post.title"
                  class="w-32 h-32 object-cover rounded"
                />
                <div class="flex-1">
                  <h3 class="text-xl font-bold mb-2 hover:text-primary">{{ post.title }}</h3>
                  <div class="text-sm text-gray-600 mb-2">
                    <span class="bg-primary-100 text-primary-700 px-2 py-1 rounded">{{ post.category.name }}</span>
                    <span v-for="tag in post.tags.slice(0, 3)" :key="tag.id" class="ml-2 bg-gray-200 text-gray-700 px-2 py-1 rounded">
                      #{{ tag.name }}
                    </span>
                  </div>
                  <p class="text-gray-700 mb-2 line-clamp-2">
                    {{ post.content.substring(0, 150) }}...
                  </p>
                  <div class="text-sm text-gray-500 flex items-center gap-4">
                    <span v-if="post.author">{{ post.author.displayName }}</span>
                    <span v-else class="italic">匿名</span>
                    <span>{{ new Date(post.createdAt).toLocaleDateString('ja-JP') }}</span>
                    <span>👁 {{ post.viewCount }}</span>
                  </div>
                </div>
              </div>
            </article>

            <!-- Pagination -->
            <div v-if="postsStore.pagination.totalPages > 1" class="flex justify-center gap-2 mt-8">
              <button
                v-for="page in postsStore.pagination.totalPages"
                :key="page"
                @click="loadPage(page)"
                :class="[
                  'px-4 py-2 rounded',
                  page === postsStore.pagination.page
                    ? 'bg-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                ]"
              >
                {{ page }}
              </button>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-6">
          <!-- Categories -->
          <div class="card">
            <h3 class="font-bold mb-4">カテゴリー</h3>
            <div class="space-y-2">
              <div class="text-sm text-gray-700 hover:text-primary cursor-pointer">コラム</div>
              <div class="text-sm text-gray-700 hover:text-primary cursor-pointer">体験談</div>
              <div class="text-sm text-gray-700 hover:text-primary cursor-pointer">その他</div>
            </div>
          </div>

          <!-- Popular tags -->
          <div class="card">
            <h3 class="font-bold mb-4">人気のタグ</h3>
            <div class="flex flex-wrap gap-2">
              <span class="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-primary hover:text-white transition">
                #メンタルヘルス
              </span>
              <span class="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-primary hover:text-white transition">
                #希死念慮
              </span>
              <span class="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-primary hover:text-white transition">
                #発達障害
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePostsStore } from '../stores/posts'

const router = useRouter()
const authStore = useAuthStore()
const postsStore = usePostsStore()

onMounted(async () => {
  await authStore.fetchUser()
  await postsStore.fetchPosts()
})

function loadPage(page: number) {
  postsStore.fetchPosts({ page })
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
