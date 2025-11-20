<template>
  <div class="home-page">
    <!-- タイムラインタブ -->
    <div class="timeline-tabs">
      <button
        :class="['tab-item', { active: activeTab === 'home' }]"
        @click="switchTab('home')"
      >
        部屋
      </button>
      <button
        :class="['tab-item', { active: activeTab === 'discover' }]"
        @click="switchTab('discover')"
      >
        発見
      </button>
    </div>

    <!-- 投稿リスト -->
    <div class="posts-container">
      <!-- Loading -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-spinner"></div>
        <p>読み込み中...</p>
      </div>

      <!-- Error -->
      <div v-else-if="currentError" class="error-state">
        <p>{{ currentError }}</p>
      </div>

      <!-- Home tab - not connected message -->
      <div v-else-if="activeTab === 'home' && !walletStore.isConnected" class="empty-state">
        <p>人格を作成して注目を始めましょう</p>
      </div>

      <!-- Posts -->
      <div v-else class="posts-list">
        <article
          v-for="post in currentPosts"
          :key="post.id"
          class="post-card"
          @click="goToPost(post.id)"
        >
          <div class="post-content">
            <p class="post-excerpt">
              {{ getExcerpt(post.content) }}
            </p>
            <div class="post-meta">
              <span class="wallet-display">
                <span v-if="post.wallet.name" class="wallet-name">{{ post.wallet.name }}</span>
                <span class="wallet-address">{{ truncateAddress(post.wallet.address) }}</span>
              </span>
              <span class="separator">·</span>
              <span class="date">{{ formatDate(post.createdAt) }}</span>
              <span v-if="post._count && post._count.replies > 0" class="replies">
                · {{ post._count.replies }} 反応
              </span>
            </div>
          </div>
        </article>

        <!-- Empty state -->
        <div v-if="currentPosts.length === 0" class="empty-state">
          <p v-if="activeTab === 'home'">まだ相談がありません。発見タブで人格を注目しましょう</p>
          <p v-else>まだ相談がありません</p>
        </div>

        <!-- Pagination -->
        <div v-if="currentPagination.totalPages > 1" class="pagination">
          <button
            v-for="page in currentPagination.totalPages"
            :key="page"
            @click="loadPage(page)"
            :class="['page-button', { active: page === currentPagination.page }]"
          >
            {{ page }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useWalletStore } from '../stores/wallet'
import { useFollowsStore } from '../stores/follows'

const router = useRouter()
const postsStore = usePostsStore()
const walletStore = useWalletStore()
const followsStore = useFollowsStore()

const activeTab = ref<'home' | 'discover'>('discover')

const isLoading = computed(() => {
  return activeTab.value === 'home' ? followsStore.loading : postsStore.loading
})

const currentError = computed(() => {
  return activeTab.value === 'home' ? followsStore.error : postsStore.error
})

const currentPosts = computed(() => {
  return activeTab.value === 'home' ? followsStore.timeline : postsStore.posts
})

const currentPagination = computed(() => {
  return activeTab.value === 'home' ? followsStore.pagination : postsStore.pagination
})

onMounted(async () => {
  // Default to discover tab
  await postsStore.fetchPosts()

  // If wallet is connected, also fetch following list
  if (walletStore.isConnected && walletStore.walletId) {
    await followsStore.fetchFollowing(walletStore.walletId)
  }
})

// Watch for wallet connection changes
watch(() => walletStore.walletId, async (newWalletId) => {
  if (newWalletId) {
    await followsStore.fetchFollowing(newWalletId)
    if (activeTab.value === 'home') {
      await followsStore.fetchTimeline(newWalletId)
    }
  }
})

async function switchTab(tab: 'home' | 'discover') {
  activeTab.value = tab

  if (tab === 'home' && walletStore.walletId) {
    await followsStore.fetchTimeline(walletStore.walletId)
  } else if (tab === 'discover') {
    await postsStore.fetchPosts()
  }
}

async function loadPage(page: number) {
  if (activeTab.value === 'home' && walletStore.walletId) {
    await followsStore.fetchTimeline(walletStore.walletId, { page })
  } else {
    await postsStore.fetchPosts({ page })
  }
}

// Truncate ETH-style address for display
function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP')
}

function getExcerpt(content: string): string {
  const lines = content.split('\n').filter(line => line.trim())
  const excerpt = lines.slice(0, 3).join('\n')
  if (excerpt.length > 150 || lines.length > 3) {
    return excerpt.substring(0, 150) + '...'
  }
  return excerpt
}

function goToPost(postId: string) {
  router.push(`/posts/${postId}`)
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
  font-weight: 500;
  color: hsl(var(--foreground-secondary));
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-normal) var(--spring-easing);
  position: relative;
  opacity: 0.7;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-item:hover {
  opacity: 1;
  background: hsl(var(--item-hover));
}

.tab-item:active {
  transform: scale(0.98);
}

.tab-item.active {
  opacity: 1;
  color: hsl(var(--foreground));
}

.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
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
  animation: slide-up var(--transition-slow) var(--spring-easing);
  animation-fill-mode: backwards;
}

.post-card:nth-child(1) { animation-delay: 0ms; }
.post-card:nth-child(2) { animation-delay: 30ms; }
.post-card:nth-child(3) { animation-delay: 60ms; }
.post-card:nth-child(4) { animation-delay: 90ms; }
.post-card:nth-child(5) { animation-delay: 120ms; }

.post-card:hover {
  background: hsl(var(--item-hover));
}

.post-card:active {
  background: hsl(var(--item-active));
}

.post-content {
  flex: 1;
  min-width: 0;
}

.post-excerpt {
  font-size: var(--font-size-base);
  color: hsl(var(--foreground));
  margin: 0 0 var(--space-3);
  line-height: var(--line-height-relaxed);
  white-space: pre-wrap;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
}

.wallet-display {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.wallet-name {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.wallet-address {
  font-family: monospace;
  color: hsl(var(--foreground-tertiary));
}

.separator {
  opacity: 0.5;
}

.replies {
  color: hsl(var(--foreground-secondary));
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
  font-weight: 500;
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

.page-button:active {
  transform: scale(0.95);
}

.page-button.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  box-shadow: var(--shadow-sm);
}
</style>
