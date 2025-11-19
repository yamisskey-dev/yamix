<template>
  <div class="post-detail-page">
    <!-- ヘッダー -->
    <div class="page-header">
      <button class="back-button" @click="router.push('/')">
        ← 戻る
      </button>
    </div>

    <!-- Loading -->
    <div v-if="postsStore.loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>読み込み中...</p>
    </div>

    <!-- Error -->
    <div v-else-if="postsStore.error" class="error-state">
      <p>{{ postsStore.error }}</p>
    </div>

    <!-- Post detail -->
    <article v-else-if="postsStore.currentPost" class="post-detail">
      <!-- Meta -->
      <div class="post-meta">
        <span class="wallet-address">{{ postsStore.currentPost.wallet.address }}</span>
        <span class="date">{{ formatDate(postsStore.currentPost.createdAt) }}</span>
        <span v-if="postsStore.currentPost._count" class="tokens">
          {{ postsStore.currentPost._count.transactions }} トークン
        </span>
      </div>

      <!-- Content -->
      <div class="post-content">
        {{ postsStore.currentPost.content }}
      </div>

      <!-- Actions -->
      <div class="post-actions">
        <button class="action-button primary" @click="sendToken">
          トークンを送る
        </button>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useWalletStore } from '../stores/wallet'

const router = useRouter()
const route = useRoute()
const postsStore = usePostsStore()
const walletStore = useWalletStore()

onMounted(async () => {
  const postId = route.params.id as string
  if (postId) {
    await postsStore.fetchPostById(postId)
  }
})

async function sendToken() {
  if (!walletStore.isConnected) {
    await walletStore.createWallet()
  }

  const postId = route.params.id as string
  if (postId) {
    await walletStore.sendTokens(postId)
    await postsStore.fetchPostById(postId)
  }
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP')
}
</script>

<style scoped>
.post-detail-page {
  min-height: 100vh;
  background: hsl(var(--background));
}

.page-header {
  padding: var(--space-3) var(--space-4);
  background: hsl(var(--background-secondary));
  border-bottom: 1px solid hsl(var(--border));
}

.back-button {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-secondary));
  background: none;
  border: none;
  cursor: pointer;
}

.back-button:hover {
  color: hsl(var(--foreground));
}

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

.error-state {
  padding: var(--space-4);
  margin: var(--space-4);
  background: hsl(var(--error) / 0.1);
  border: 1px solid hsl(var(--error) / 0.2);
  border-radius: var(--radius-lg);
  color: hsl(var(--error));
  font-size: var(--font-size-md);
}

.post-detail {
  padding: var(--space-4);
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-tertiary));
}

.wallet-address {
  font-family: monospace;
  padding: 2px var(--space-2);
  background: hsl(var(--item-hover));
  border-radius: var(--radius-sm);
}

.tokens {
  color: hsl(var(--primary));
  font-weight: 500;
}

.post-content {
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  color: hsl(var(--foreground));
  white-space: pre-wrap;
  margin-bottom: var(--space-6);
}

.post-actions {
  padding-top: var(--space-4);
  border-top: 1px solid hsl(var(--border));
}

.action-button {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all var(--transition-normal);
}

.action-button:hover {
  background: hsl(var(--item-hover));
}

.action-button.primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.action-button.primary:hover {
  opacity: 0.9;
}
</style>
