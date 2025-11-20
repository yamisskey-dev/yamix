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
        <div v-if="profileWallet.name" class="wallet-name-display">{{ profileWallet.name }}</div>
        <div class="wallet-address-display">{{ profileWallet.address }}</div>
        <div v-if="isOwnWallet" class="wallet-balance">{{ profileWallet.balance }} トークン</div>
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
            class="post-card"
            @click="openReader(post)"
          >
            <div class="post-content">
              <p class="post-excerpt">{{ getExcerpt(post.content) }}</p>
              <div class="post-meta">
                <span class="date">{{ formatDate(post.createdAt) }}</span>
                <span v-if="post._count && post._count.replies > 0" class="replies">
                  · {{ post._count.replies }} 返信
                </span>
              </div>
            </div>
          </article>
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
            <span class="reader-date">{{ formatDate(selectedPost.createdAt) }}</span>
          </div>
          <div v-if="isOwnWallet" class="reader-actions">
            <button
              class="reader-action-button danger"
              @click="confirmDelete(selectedPost.id)"
            >
              削除
            </button>
          </div>
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
import type { Wallet, PostWithRelations } from '@yamix/shared'

const router = useRouter()
const route = useRoute()
const postsStore = usePostsStore()
const walletStore = useWalletStore()
const followsStore = useFollowsStore()

const profileWallet = ref<Wallet | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const selectedPost = ref<PostWithRelations | null>(null)
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

function getExcerpt(content: string): string {
  const lines = content.split('\n').filter(line => line.trim())
  const excerpt = lines.slice(0, 3).join('\n')
  if (excerpt.length > 150 || lines.length > 3) {
    return `${excerpt.substring(0, 150)}...`
  }
  return excerpt
}

function openReader(post: PostWithRelations) {
  selectedPost.value = post
}

function closeReader() {
  selectedPost.value = null
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
  selectedPost.value = null
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

.wallet-name-display {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: hsl(var(--foreground));
  margin-bottom: var(--space-2);
}

.wallet-address-display {
  font-family: monospace;
  font-size: var(--font-size-md);
  padding: var(--space-2) var(--space-3);
  background: hsl(var(--item-hover));
  border-radius: var(--radius-md);
  display: inline-block;
  margin-bottom: var(--space-2);
  color: hsl(var(--foreground-secondary));
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
}

.post-card {
  padding: var(--space-4);
  background: hsl(var(--background-secondary));
  border-bottom: 1px solid hsl(var(--border));
  cursor: pointer;
  transition: all var(--transition-normal);
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

.replies {
  color: hsl(var(--foreground-secondary));
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

.reader-action-button.danger {
  background: hsl(var(--error));
  color: white;
  border-color: hsl(var(--error));
}

.reader-action-button.danger:hover {
  opacity: 0.9;
}
</style>
