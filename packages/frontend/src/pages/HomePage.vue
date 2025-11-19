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
}

.tab-item {
  flex: 1;
  padding: var(--space-4) var(--space-4);
  font-size: var(--font-size-md);
  font-weight: 600;
  color: hsl(var(--foreground-secondary));
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-normal) var(--spring-easing);
  position: relative;
}

.tab-item:hover {
  background: hsl(var(--item-hover));
  color: hsl(var(--foreground));
}

.tab-item.active {
  color: hsl(var(--primary));
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: hsl(var(--primary));
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

.post-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: hsl(var(--foreground));
  margin: 0 0 var(--space-2);
  line-height: var(--line-height-tight);
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.category-badge {
  font-size: var(--font-size-xs);
  padding: 2px var(--space-2);
  background: hsl(var(--accent-light));
  color: hsl(var(--primary));
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.tag-badge {
  font-size: var(--font-size-xs);
  padding: 2px var(--space-2);
  background: hsl(var(--item-hover));
  color: hsl(var(--foreground-secondary));
  border-radius: var(--radius-sm);
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

.author.anonymous {
  font-style: italic;
}

.post-thumbnail {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-lg);
  flex-shrink: 0;
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
