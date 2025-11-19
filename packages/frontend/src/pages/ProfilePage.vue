<template>
  <div class="profile-page">
    <!-- ヘッダー -->
    <div class="page-header">
      <button class="back-button" @click="router.push('/')">
        ← 戻る
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

    <!-- Profile content -->
    <div v-else-if="profileWallet" class="profile-content">
      <!-- Wallet info -->
      <div class="wallet-info">
        <div class="wallet-address-display">{{ profileWallet.address }}</div>
        <div class="wallet-balance">{{ profileWallet.balance }} トークン</div>
        <div v-if="isOwnWallet" class="own-badge">あなたのウォレット</div>
        <button
          v-else-if="walletStore.isConnected"
          class="follow-button"
          :class="{ following: isFollowing }"
          @click="toggleFollow"
          :disabled="followsStore.loading"
        >
          {{ isFollowing ? 'フォロー中' : 'フォローする' }}
        </button>
      </div>

      <!-- Posts list -->
      <div class="posts-section">
        <h2 class="section-title">投稿一覧</h2>

        <div v-if="postsStore.posts.length === 0" class="empty-state">
          <p>まだ投稿がありません</p>
        </div>

        <div v-else class="posts-list">
          <article
            v-for="post in postsStore.posts"
            :key="post.id"
            class="post-item"
            :class="{ expanded: expandedPost === post.id }"
            @click="toggleExpand(post.id)"
          >
            <div class="post-content">
              <p class="post-text">{{ post.content }}</p>
              <div class="post-footer">
                <span class="date">{{ formatDate(post.createdAt) }}</span>
                <span v-if="post._count" class="tokens">{{ post._count.transactions }} トークン</span>
              </div>
            </div>

            <!-- Actions (visible when expanded) -->
            <div v-if="expandedPost === post.id" class="post-actions" @click.stop>
              <button
                class="action-button primary"
                @click="sendToken(post.id)"
                :disabled="walletStore.loading"
              >
                トークンを送る
              </button>
              <button
                v-if="isOwnWallet"
                class="action-button danger"
                @click="confirmDelete(post.id)"
              >
                削除
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>

    <!-- 削除確認モーダル -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click="showDeleteConfirm = false">
      <div class="confirm-modal" @click.stop>
        <h3>投稿を削除</h3>
        <p>この投稿を削除しますか？</p>
        <p class="warning-text">この操作は取り消せません。</p>
        <div class="modal-actions">
          <button class="action-button" @click="showDeleteConfirm = false">キャンセル</button>
          <button class="action-button danger" @click="deletePost">削除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useWalletStore } from '../stores/wallet'
import { useFollowsStore } from '../stores/follows'
import { api } from '../api/client'
import type { Wallet } from '@yamix/shared'

const router = useRouter()
const route = useRoute()
const postsStore = usePostsStore()
const walletStore = useWalletStore()
const followsStore = useFollowsStore()

const profileWallet = ref<Wallet | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const expandedPost = ref<string | null>(null)
const showDeleteConfirm = ref(false)
const postToDelete = ref<string | null>(null)

const isOwnWallet = computed(() => {
  if (!profileWallet.value || !walletStore.address) return false
  return profileWallet.value.address === walletStore.address
})

const isFollowing = computed(() => {
  if (!profileWallet.value) return false
  return followsStore.isFollowing(profileWallet.value.address)
})

onMounted(async () => {
  const address = route.params.address as string
  if (address) {
    await loadProfile(address)
  }

  // Fetch following list if wallet is connected
  if (walletStore.walletId) {
    await followsStore.fetchFollowing(walletStore.walletId)
  }
})

async function loadProfile(address: string) {
  loading.value = true
  error.value = null

  try {
    // Fetch wallet info
    profileWallet.value = await api.get<Wallet>(`/api/wallets/${address}`)
    // Fetch posts
    await postsStore.fetchPostsByWallet(address)
  } catch (err: any) {
    error.value = err.message || 'プロフィールの読み込みに失敗しました'
  } finally {
    loading.value = false
  }
}

async function toggleFollow() {
  if (!profileWallet.value || !walletStore.walletId) return

  if (isFollowing.value) {
    await followsStore.unfollow(walletStore.walletId, profileWallet.value.address)
  } else {
    await followsStore.follow(walletStore.walletId, profileWallet.value.address)
  }
}

function toggleExpand(postId: string) {
  expandedPost.value = expandedPost.value === postId ? null : postId
}

async function sendToken(postId: string) {
  if (!walletStore.isConnected) {
    await walletStore.createWallet()
  }

  await walletStore.sendTokens(postId)

  // Refresh posts and wallet balance
  const address = route.params.address as string
  if (address) {
    await postsStore.fetchPostsByWallet(address)
    profileWallet.value = await api.get<Wallet>(`/api/wallets/${address}`)
  }
}

function confirmDelete(postId: string) {
  postToDelete.value = postId
  showDeleteConfirm.value = true
}

async function deletePost() {
  if (postToDelete.value && walletStore.walletId) {
    await postsStore.deletePost(postToDelete.value, walletStore.walletId)

    // Refresh posts
    const address = route.params.address as string
    if (address) {
      await postsStore.fetchPostsByWallet(address)
    }
  }
  showDeleteConfirm.value = false
  postToDelete.value = null
  expandedPost.value = null
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ja-JP')
}
</script>

<style scoped>
.profile-page {
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

.profile-content {
  padding: var(--space-4);
}

/* Wallet info */
.wallet-info {
  padding: var(--space-4);
  background: hsl(var(--background-secondary));
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
  text-align: center;
}

.wallet-address-display {
  font-family: monospace;
  font-size: var(--font-size-lg);
  padding: var(--space-2) var(--space-3);
  background: hsl(var(--item-hover));
  border-radius: var(--radius-md);
  display: inline-block;
  margin-bottom: var(--space-2);
}

.wallet-balance {
  font-size: var(--font-size-md);
  color: hsl(var(--primary));
  font-weight: 500;
  margin-bottom: var(--space-2);
}

.own-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.follow-button {
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  border: 1px solid hsl(var(--primary));
  border-radius: var(--radius-md);
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  transition: all var(--transition-normal);
}

.follow-button:hover:not(:disabled) {
  opacity: 0.9;
}

.follow-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.follow-button.following {
  background: transparent;
  color: hsl(var(--primary));
}

/* Posts section */
.section-title {
  font-size: var(--font-size-md);
  font-weight: 500;
  margin: 0 0 var(--space-3);
  color: hsl(var(--foreground));
}

.posts-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.post-item {
  padding: var(--space-3);
  background: hsl(var(--background-secondary));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
}

.post-item:hover {
  background: hsl(var(--item-hover));
}

.post-item.expanded {
  background: hsl(var(--item-active));
}

.post-text {
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  color: hsl(var(--foreground));
  white-space: pre-wrap;
  margin: 0 0 var(--space-2);
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

.post-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
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

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button.primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.action-button.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.action-button.danger {
  background: hsl(var(--error));
  color: white;
  border-color: hsl(var(--error));
}

.action-button.danger:hover {
  opacity: 0.9;
}

.empty-state {
  padding: var(--space-8) var(--space-4);
  text-align: center;
  color: hsl(var(--foreground-secondary));
  font-size: var(--font-size-md);
}

/* モーダル */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  z-index: 100;
}

.confirm-modal {
  background: hsl(var(--background));
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  width: 90%;
  max-width: 360px;
}

.confirm-modal h3 {
  margin: 0 0 var(--space-3);
  font-size: var(--font-size-md);
  color: hsl(var(--foreground));
}

.confirm-modal p {
  margin: 0 0 var(--space-2);
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground-secondary));
}

.warning-text {
  color: hsl(var(--error)) !important;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.modal-actions .action-button {
  flex: 1;
}
</style>
