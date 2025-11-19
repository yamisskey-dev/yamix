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
      <!-- Loading -->
      <div v-if="postsStore.loading" class="text-center py-12">
        <div class="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
        <p class="mt-4 text-gray-600">読み込み中...</p>
      </div>

      <!-- Error -->
      <div v-else-if="postsStore.error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-700">{{ postsStore.error }}</p>
        <RouterLink to="/" class="text-primary underline mt-4 block">ホームに戻る</RouterLink>
      </div>

      <!-- Post detail -->
      <article v-else-if="postsStore.currentPost" class="card">
        <!-- Category & Tags -->
        <div class="mb-4 flex flex-wrap gap-2">
          <span class="bg-primary-100 text-primary-700 px-3 py-1 rounded">
            {{ postsStore.currentPost.category.name }}
          </span>
          <span
            v-for="tag in postsStore.currentPost.tags"
            :key="tag.id"
            class="bg-gray-200 text-gray-700 px-3 py-1 rounded cursor-pointer hover:bg-gray-300"
            @click="router.push(`/tags/${tag.name}`)"
          >
            #{{ tag.name }}
          </span>
        </div>

        <!-- Title -->
        <h1 class="text-4xl font-bold mb-4">{{ postsStore.currentPost.title }}</h1>

        <!-- Meta info -->
        <div class="flex items-center gap-4 mb-6 text-sm text-gray-600 pb-6 border-b">
          <span v-if="postsStore.currentPost.author">
            {{ postsStore.currentPost.author.displayName }}
          </span>
          <span v-else class="italic">匿名</span>
          <span>{{ new Date(postsStore.currentPost.createdAt).toLocaleDateString('ja-JP') }}</span>
          <span>👁 {{ postsStore.currentPost.viewCount }}</span>
        </div>

        <!-- Thumbnail -->
        <img
          v-if="postsStore.currentPost.thumbnailUrl"
          :src="postsStore.currentPost.thumbnailUrl"
          :alt="postsStore.currentPost.title"
          class="w-full h-auto rounded-lg mb-6"
        />

        <!-- Content -->
        <div class="prose prose-lg max-w-none">
          <div class="whitespace-pre-wrap">{{ postsStore.currentPost.content }}</div>
        </div>

        <!-- Actions -->
        <div class="mt-8 pt-6 border-t flex gap-4">
          <button class="btn-secondary">いいね</button>
          <button class="btn-secondary">ブックマーク</button>
          <button class="btn-secondary">共有</button>
        </div>
      </article>

      <!-- Comments section -->
      <div v-if="postsStore.currentPost" class="mt-8">
        <div class="card">
          <h2 class="text-2xl font-bold mb-6">コメント</h2>

          <!-- Comment form -->
          <div v-if="authStore.isAuthenticated" class="mb-6">
            <textarea
              class="w-full border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-primary"
              rows="3"
              placeholder="コメントを入力..."
            ></textarea>
            <div class="mt-2 flex justify-end">
              <button class="btn-primary">コメントする</button>
            </div>
          </div>
          <div v-else class="mb-6 bg-gray-50 p-4 rounded-lg text-center">
            <p class="text-gray-600 mb-2">コメントするにはログインが必要です</p>
            <RouterLink to="/login" class="text-primary underline">ログイン</RouterLink>
          </div>

          <!-- Comments list -->
          <div class="space-y-4">
            <p class="text-gray-500 text-center py-8">まだコメントがありません</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePostsStore } from '../stores/posts'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const postsStore = usePostsStore()

onMounted(async () => {
  await authStore.fetchUser()
  const postId = Number(route.params.id)
  if (postId) {
    await postsStore.fetchPostById(postId)
  }
})
</script>
