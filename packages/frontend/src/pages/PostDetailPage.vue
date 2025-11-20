<template>
  <div class="post-detail-page">
    <!-- Header with back button -->
    <div class="detail-header">
      <button class="back-button" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        戻る
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>読み込み中...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
    </div>

    <!-- Post content -->
    <div v-else-if="post" class="detail-content">
      <article class="post-article">
        <p class="post-text">{{ post.content }}</p>
      </article>

      <div class="post-meta">
        <span
          class="post-wallet"
          @click="goToProfile(post.wallet.address)"
        >
          <span v-if="post.wallet.name" class="wallet-name">{{ post.wallet.name }} </span>{{ truncateAddress(post.wallet.address) }}
        </span>
        <span class="post-date">{{ formatDate(post.createdAt) }}</span>
      </div>

      <div class="post-actions">
        <button
          class="action-button"
          @click="goToProfile(post.wallet.address)"
        >
          プロフィールを見る
        </button>
      </div>

      <!-- Replies section -->
      <div class="replies-section">
        <h3 class="replies-title">返信</h3>

        <!-- Reply form -->
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

        <!-- Replies list -->
        <div v-if="post.replies && post.replies.length > 0" class="replies-list">
          <article
            v-for="reply in post.replies"
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
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useWalletStore } from '../stores/wallet'

const route = useRoute()
const router = useRouter()
const postsStore = usePostsStore()
const walletStore = useWalletStore()

const replyContent = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

const post = computed(() => postsStore.currentPost)

onMounted(async () => {
  const postId = route.params.id as string
  loading.value = true
  error.value = null

  try {
    await postsStore.fetchPostById(postId)
    if (!postsStore.currentPost) {
      error.value = '投稿が見つかりません'
    }
  } catch (err: any) {
    error.value = err.message || '投稿の読み込みに失敗しました'
  } finally {
    loading.value = false
  }
})

function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP')
}

function goBack() {
  router.back()
}

function goToProfile(address: string) {
  router.push(`/${address}`)
}

async function submitReply() {
  if (!post.value || !replyContent.value.trim()) return

  // Ensure wallet exists
  if (!walletStore.isConnected) {
    await walletStore.createWallet()
  }

  if (!walletStore.walletId) return

  // Create reply
  const reply = await postsStore.createPost({
    content: replyContent.value,
    walletId: walletStore.walletId,
    parentId: post.value.id,
  })

  if (reply) {
    // Clear input and refresh post
    replyContent.value = ''
    await postsStore.fetchPostById(post.value.id)

    // Refresh wallet balance
    await walletStore.refreshBalance()
  }
}
</script>

<style scoped>
.post-detail-page {
  padding: var(--space-4);
  max-width: 800px;
  margin: 0 auto;
}

.detail-header {
  margin-bottom: var(--space-4);
}

.back-button {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: none;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-normal) var(--spring-easing);
}

.back-button:hover {
  background: hsl(var(--item-hover));
}

.back-button:active {
  transform: scale(0.97);
}

.loading-state,
.error-state {
  text-align: center;
  padding: var(--space-8);
  color: hsl(var(--foreground-secondary));
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid hsl(var(--border));
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto var(--space-4);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.detail-content {
  background: hsl(var(--background-secondary));
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  animation: slide-up var(--transition-slow) var(--spring-easing);
}

.post-article {
  margin-bottom: var(--space-4);
}

.post-text {
  font-size: var(--font-size-lg);
  line-height: 1.8;
  white-space: pre-wrap;
  color: hsl(var(--foreground));
}

.post-meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-top: 1px solid hsl(var(--border));
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-secondary));
}

.post-wallet {
  cursor: pointer;
}

.post-wallet:hover {
  color: hsl(var(--primary));
}

.wallet-name {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.post-actions {
  padding: var(--space-3) 0;
  border-bottom: 1px solid hsl(var(--border));
}

.action-button {
  padding: var(--space-2) var(--space-3);
  background: hsl(var(--primary));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-normal) var(--spring-easing);
}

.action-button:hover {
  background: hsl(var(--primary-hover));
}

.action-button:active {
  transform: scale(0.97);
}

/* Replies section */
.replies-section {
  margin-top: var(--space-6);
}

.replies-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin-bottom: var(--space-4);
  color: hsl(var(--foreground));
}

.reply-form {
  margin-bottom: var(--space-4);
}

.reply-input {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: var(--font-size-sm);
  resize: vertical;
  margin-bottom: var(--space-2);
  transition: border-color var(--transition-fast);
}

.reply-input:hover {
  border-color: hsl(var(--border-hover));
}

.reply-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
}

.reply-submit {
  padding: var(--space-2) var(--space-4);
  background: hsl(var(--primary));
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-normal) var(--spring-easing);
}

.reply-submit:hover:not(:disabled) {
  background: hsl(var(--primary-hover));
}

.reply-submit:active:not(:disabled) {
  transform: scale(0.97);
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
  background: hsl(var(--background));
  border-radius: var(--radius-md);
  border: 1px solid hsl(var(--border));
  animation: slide-up var(--transition-slow) var(--spring-easing);
  animation-fill-mode: backwards;
}

.reply-card:nth-child(1) { animation-delay: 0ms; }
.reply-card:nth-child(2) { animation-delay: 50ms; }
.reply-card:nth-child(3) { animation-delay: 100ms; }

.reply-text {
  font-size: var(--font-size-sm);
  line-height: 1.6;
  white-space: pre-wrap;
  margin-bottom: var(--space-2);
  color: hsl(var(--foreground));
}

.reply-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
}

.reply-wallet {
  cursor: pointer;
}

.reply-wallet:hover {
  color: hsl(var(--primary));
}

.no-replies {
  text-align: center;
  padding: var(--space-4);
  color: hsl(var(--foreground-tertiary));
  font-size: var(--font-size-sm);
}
</style>
