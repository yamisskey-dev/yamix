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
            <div class="post-meta">
              <span class="category-badge">{{ post.category.name }}</span>
              <span class="wallet-address">{{ post.wallet.address }}</span>
            </div>
            <p class="post-excerpt">
              {{ post.content.length > 200 ? post.content.substring(0, 200) + '...' : post.content }}
            </p>
            <div class="post-footer">
              <span class="date">{{ formatDate(post.createdAt) }}</span>
              <span v-if="post._count" class="tokens">{{ post._count.transactions }} tokens</span>
            </div>
          </div>
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

const activeTab = ref<'latest'>('latest')

onMounted(async () => {
  await postsStore.fetchPosts()
})

function switchTab(tab: 'latest') {
  activeTab.value = tab
  postsStore.fetchPosts()
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
  background: hsl(var(--background-secondary));
  border-bottom: 1px solid hsl(var(--border));
  position: sticky;
  top: 0;
  z-index: 10;
  height: 40px;
}

.tab-item {
  flex: 1;
  padding: 0 10px;
  font-size: 0.8em;
  font-weight: normal;
  color: hsl(var(--foreground-secondary));
  background: none;
  border: none;
  cursor: pointer;
  transition: opacity var(--transition-normal);
  position: relative;
  opacity: 0.7;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-item:hover {
  opacity: 1;
}

.tab-item.active {
  opacity: 1;
  color: hsl(var(--foreground));
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: hsl(var(--primary));
  border-radius: 999px;
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
  padding: var(--space-12) var(--space-4);
  color: hsl(var(--foreground-secondary));
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid hsl(var(--border));
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: var(--space-3);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* エラー */
.error-state {
  padding: var(--space-4);
  margin: var(--space-4);
  background: hsl(var(--error) / 0.1);
  border: 1px solid hsl(var(--error) / 0.2);
  border-radius: var(--radius-lg);
  color: hsl(var(--error));
  font-size: var(--font-size-md);
}

/* 投稿リスト */
.posts-list {
  display: flex;
  flex-direction: column;
}

/* 投稿カード */
.post-card {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
  background: hsl(var(--background-secondary));
  border-bottom: 1px solid hsl(var(--border));
  cursor: pointer;
  transition: all var(--transition-normal) var(--spring-easing);
}

.post-card:hover {
  background: hsl(var(--item-hover));
}

.post-content {
  flex: 1;
  min-width: 0;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  align-items: center;
}

.category-badge {
  font-size: var(--font-size-xs);
  padding: 2px var(--space-2);
  background: hsl(var(--accent-light));
  color: hsl(var(--primary));
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.wallet-address {
  font-size: var(--font-size-xs);
  padding: 2px var(--space-2);
  background: hsl(var(--item-hover));
  color: hsl(var(--foreground-tertiary));
  border-radius: var(--radius-sm);
  font-family: monospace;
}

.post-excerpt {
  font-size: var(--font-size-base);
  color: hsl(var(--foreground-secondary));
  margin: 0 0 var(--space-2);
  line-height: var(--line-height-normal);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.post-footer {
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-tertiary));
}

.tokens {
  color: hsl(var(--primary));
  font-weight: 500;
}

/* 空状態 */
.empty-state {
  padding: var(--space-12) var(--space-4);
  text-align: center;
  color: hsl(var(--foreground-secondary));
  font-size: var(--font-size-md);
}

/* ページネーション */
.pagination {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-4);
  background: hsl(var(--background-secondary));
  border-top: 1px solid hsl(var(--border));
}

.page-button {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-base);
  border: none;
  border-radius: var(--radius-md);
  background: hsl(var(--item-hover));
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all var(--transition-normal) var(--spring-easing);
}

.page-button:hover {
  background: hsl(var(--item-active));
}

.page-button.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
</style>
