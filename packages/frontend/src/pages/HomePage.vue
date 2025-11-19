<template>
  <div class="home-page">
    <!-- タイムラインタブ -->
    <div class="timeline-tabs">
      <button
        :class="['tab-item', { active: activeTab === 'latest' }]"
        @click="switchTab('latest')"
      >
        最新
      </button>
      <button
        :class="['tab-item', { active: activeTab === 'popular' }]"
        @click="switchTab('popular')"
      >
        人気
      </button>
      <button
        :class="['tab-item', { active: activeTab === 'support' }]"
        @click="switchTab('support')"
      >
        支援情報
      </button>
      <button
        :class="['tab-item', { active: activeTab === 'search' }]"
        @click="switchTab('search')"
      >
        検索
      </button>
    </div>

    <!-- 投稿リスト -->
    <div class="posts-container">
      <!-- Loading -->
      <div v-if="postsStore.loading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>読み込み中...</p>
      </div>

      <!-- Error -->
      <div v-else-if="postsStore.error" class="error-state">
        <p>{{ postsStore.error }}</p>
      </div>

      <!-- Posts -->
      <div v-else class="posts-list">
        <article
          v-for="post in postsStore.posts"
          :key="post.id"
          class="post-card"
          @click="router.push(`/posts/${post.id}`)"
        >
          <div class="post-content">
            <h3 class="post-title">{{ post.title }}</h3>
            <div class="post-meta">
              <span class="category-badge">{{ post.category.name }}</span>
              <span
                v-for="tag in post.tags.slice(0, 3)"
                :key="tag.id"
                class="tag-badge"
              >
                #{{ tag.name }}
              </span>
            </div>
            <p class="post-excerpt">
              {{ post.content.substring(0, 150) }}...
            </p>
            <div class="post-footer">
              <span v-if="post.author" class="author">{{ post.author.displayName }}</span>
              <span v-else class="author anonymous">匿名</span>
              <span class="date">{{ formatDate(post.createdAt) }}</span>
              <span class="views">{{ post.viewCount }} views</span>
            </div>
          </div>
          <img
            v-if="post.thumbnailUrl"
            :src="post.thumbnailUrl"
            :alt="post.title"
            class="post-thumbnail"
          />
        </article>

        <!-- Empty state -->
        <div v-if="postsStore.posts.length === 0" class="empty-state">
          <p>まだ投稿がありません</p>
        </div>

        <!-- Pagination -->
        <div v-if="postsStore.pagination.totalPages > 1" class="pagination">
          <button
            v-for="page in postsStore.pagination.totalPages"
            :key="page"
            @click="loadPage(page)"
            :class="['page-button', { active: page === postsStore.pagination.page }]"
          >
            {{ page }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePostsStore } from '../stores/posts'

const router = useRouter()
const postsStore = usePostsStore()

const activeTab = ref<'latest' | 'popular' | 'support' | 'search'>('latest')

onMounted(async () => {
  await postsStore.fetchPosts()
})

function switchTab(tab: 'latest' | 'popular' | 'support' | 'search') {
  activeTab.value = tab
  // TODO: 各タブの機能を実装
  if (tab === 'latest' || tab === 'popular') {
    postsStore.fetchPosts()
  }
  // support と search は後で実装
}

function loadPage(page: number) {
  postsStore.fetchPosts({ page })
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP')
}
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* タイムラインタブ */
.timeline-tabs {
  display: flex;
  background: white;
  border-bottom: 1px solid #e5e5e5;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tab-item {
  flex: 1;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  position: relative;
}

.tab-item:hover {
  background: #f9fafb;
  color: #374151;
}

.tab-item.active {
  color: #9333ea;
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: #9333ea;
}

/* 投稿コンテナ */
.posts-container {
  flex: 1;
}

/* ローディング */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: #6b7280;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #9333ea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* エラー */
.error-state {
  padding: 16px;
  margin: 16px;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  font-size: 14px;
}

/* 投稿リスト */
.posts-list {
  display: flex;
  flex-direction: column;
}

/* 投稿カード */
.post-card {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: white;
  border-bottom: 1px solid #e5e5e5;
  cursor: pointer;
  transition: background 0.2s;
}

.post-card:hover {
  background: #f9fafb;
}

.post-content {
  flex: 1;
  min-width: 0;
}

.post-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px;
  line-height: 1.4;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.category-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: #f3e8ff;
  color: #9333ea;
  border-radius: 4px;
}

.tag-badge {
  font-size: 11px;
  padding: 2px 6px;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
}

.post-excerpt {
  font-size: 13px;
  color: #4b5563;
  margin: 0 0 8px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-footer {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #9ca3af;
}

.author.anonymous {
  font-style: italic;
}

.post-thumbnail {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
}

/* 空状態 */
.empty-state {
  padding: 48px 16px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

/* ページネーション */
.pagination {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  background: white;
  border-top: 1px solid #e5e5e5;
}

.page-button {
  padding: 8px 12px;
  font-size: 13px;
  border: none;
  border-radius: 6px;
  background: #f3f4f6;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s;
}

.page-button:hover {
  background: #e5e7eb;
}

.page-button.active {
  background: #9333ea;
  color: white;
}
</style>
