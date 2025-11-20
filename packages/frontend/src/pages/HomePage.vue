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
        <p>ウォレットを作成してフォローを始めましょう</p>
      </div>

      <!-- Posts -->
      <div v-else class="posts-list">
        <article
          v-for="post in currentPosts"
          :key="post.id"
          class="post-card"
          @click="openReader(post)"
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
                · {{ post._count.replies }} 返信
              </span>
            </div>
          </div>
        </article>

        <!-- Empty state -->
        <div v-if="currentPosts.length === 0" class="empty-state">
          <p v-if="activeTab === 'home'">まだ投稿がありません。発見タブでウォレットをフォローしましょう</p>
          <p v-else>まだ投稿がありません</p>
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

    <!-- 読書モードモーダル -->
    <div v-if="selectedPost" class="reader-overlay" @click="closeReader">
      <div class="reader-modal" @click.stop>
        <div class="reader-header">
          <button class="close-button" @click="closeReader">×</button>
        </div>
        <div class="reader-content">
          <article class="reader-article">
            <p class="reader-text">{{ selectedPost.content }}</p>
          </article>
          <div class="reader-meta">
            <span
              class="reader-wallet"
              @click="goToProfile(selectedPost.wallet.address)"
            >
              <span v-if="selectedPost.wallet.name" class="wallet-name">{{ selectedPost.wallet.name }} </span>{{ truncateAddress(selectedPost.wallet.address) }}
            </span>
            <span class="reader-date">{{ formatDate(selectedPost.createdAt) }}</span>
          </div>
          <div class="reader-actions">
            <button
              class="reader-action-button"
              @click="goToProfile(selectedPost.wallet.address)"
            >
              プロフィールを見る
            </button>
          </div>

          <!-- 返信セクション -->
          <div class="replies-section">
            <h3 class="replies-title">返信</h3>

            <!-- 返信フォーム -->
            <div class="reply-form">
              <textarea
                v-model="replyContent"
                class="reply-input"
                placeholder="返信を入力..."
                rows="3"
              ></textarea>
              <button
                class="reply-submit"
                @click="submitReply"
                :disabled="!replyContent.trim() || postsStore.loading"
              >
                返信する
              </button>
            </div>

            <!-- 返信リスト -->
            <div v-if="detailedPost?.replies && detailedPost.replies.length > 0" class="replies-list">
              <article
                v-for="reply in detailedPost.replies"
                :key="reply.id"
                class="reply-card"
              >
                <p class="reply-text">{{ reply.content }}</p>
                <div class="reply-meta">
                  <span
                    class="reply-wallet"
                    @click="goToProfile(reply.wallet.address)"
                  >
                    <span v-if="reply.wallet.name" class="wallet-name">{{ reply.wallet.name }} </span>{{ truncateAddress(reply.wallet.address) }}
                  </span>
                  <span class="reply-date">{{ formatDate(reply.createdAt) }}</span>
                </div>
              </article>
            </div>
            <div v-else class="no-replies">
              <p>まだ返信がありません</p>
            </div>
          </div>
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
import type { PostWithRelations } from '@yamix/shared'

const router = useRouter()
const postsStore = usePostsStore()
const walletStore = useWalletStore()
const followsStore = useFollowsStore()

const activeTab = ref<'home' | 'discover'>('discover')
const selectedPost = ref<PostWithRelations | null>(null)
const detailedPost = ref<PostWithRelations | null>(null)
const replyContent = ref('')

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

async function openReader(post: PostWithRelations) {
  selectedPost.value = post
  replyContent.value = ''

  // Fetch detailed post with replies
  await postsStore.fetchPostById(post.id)
  detailedPost.value = postsStore.currentPost
}

function closeReader() {
  selectedPost.value = null
  detailedPost.value = null
  replyContent.value = ''
}

async function submitReply() {
  if (!selectedPost.value || !replyContent.value.trim()) return

  // Ensure wallet exists
  if (!walletStore.isConnected) {
    await walletStore.createWallet()
  }

  if (!walletStore.walletId) return

  // Create reply
  const reply = await postsStore.createPost({
    content: replyContent.value,
    walletId: walletStore.walletId,
    parentId: selectedPost.value.id,
  })

  if (reply) {
    // Clear input and refresh post
    replyContent.value = ''
    await postsStore.fetchPostById(selectedPost.value.id)
    detailedPost.value = postsStore.currentPost

    // Refresh wallet balance
    await walletStore.refreshBalance()
  }
}

function goToProfile(address: string) {
  closeReader()
  router.push(`/@${address}`)
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

/* 読書モードモーダル */
.reader-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: hsl(var(--background) / 0.95);
  z-index: 100;
  overflow-y: auto;
  padding: var(--space-4);
}

.reader-modal {
  max-width: 640px;
  margin: 0 auto;
  background: hsl(var(--background));
  min-height: 100%;
}

.reader-header {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-2) 0;
  position: sticky;
  top: 0;
  background: hsl(var(--background));
}

.close-button {
  padding: var(--space-2);
  font-size: var(--font-size-lg);
  color: hsl(var(--foreground-tertiary));
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1;
}

.close-button:hover {
  color: hsl(var(--foreground));
}

.reader-content {
  padding: var(--space-4) 0 var(--space-8);
}

.reader-article {
  margin-bottom: var(--space-6);
}

.reader-text {
  font-size: 1.125rem;
  line-height: 1.8;
  color: hsl(var(--foreground));
  white-space: pre-wrap;
  margin: 0;
}

.reader-meta {
  display: flex;
  gap: var(--space-3);
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-tertiary));
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid hsl(var(--border));
}

.reader-wallet {
  font-family: monospace;
  cursor: pointer;
}

.reader-wallet:hover {
  color: hsl(var(--primary));
}

.reader-actions {
  display: flex;
  gap: var(--space-3);
}

.reader-action-button {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-sm);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all var(--transition-normal);
}

.reader-action-button:hover {
  background: hsl(var(--item-hover));
}

.reader-action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reader-action-button.primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.reader-action-button.primary:hover:not(:disabled) {
  opacity: 0.9;
}

/* 返信セクション */
.replies-section {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid hsl(var(--border));
}

.replies-title {
  font-size: var(--font-size-md);
  font-weight: 500;
  margin: 0 0 var(--space-4);
  color: hsl(var(--foreground));
}

.reply-form {
  margin-bottom: var(--space-4);
}

.reply-input {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: hsl(var(--foreground));
  background: hsl(var(--background-secondary));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  resize: none;
  margin-bottom: var(--space-2);
}

.reply-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
}

.reply-input::placeholder {
  color: hsl(var(--foreground-tertiary));
}

.reply-submit {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity var(--transition-normal);
}

.reply-submit:hover:not(:disabled) {
  opacity: 0.9;
}

.reply-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.replies-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.reply-card {
  padding: var(--space-3);
  background: hsl(var(--background-secondary));
  border-radius: var(--radius-md);
}

.reply-text {
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: hsl(var(--foreground));
  margin: 0 0 var(--space-2);
  white-space: pre-wrap;
}

.reply-meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
}

.reply-wallet {
  font-family: monospace;
  cursor: pointer;
}

.reply-wallet:hover {
  color: hsl(var(--primary));
}

.no-replies {
  padding: var(--space-4);
  text-align: center;
  color: hsl(var(--foreground-secondary));
  font-size: var(--font-size-sm);
}
</style>
