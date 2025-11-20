<template>
  <div class="post-create-page">
    <!-- ヘッダー -->
    <div class="page-header">
      <button class="back-button" @click="router.push('/')">
        ← 戻る
      </button>
      <span class="page-title">新規相談</span>
    </div>

    <!-- フォーム -->
    <div class="form-container">
      <!-- Error -->
      <div v-if="postsStore.error" class="error-state">
        <p>{{ postsStore.error }}</p>
      </div>

      <form @submit.prevent="handleSubmit">
        <!-- Content -->
        <textarea
          v-model="content"
          class="content-input"
          placeholder="いま何を考えていますか？"
          rows="10"
          required
        ></textarea>

        <!-- Actions -->
        <div class="form-actions">
          <span class="wallet-info">
            相談者: {{ walletStore.address ? truncateAddress(walletStore.address) : '自動生成' }}
          </span>
          <button
            type="submit"
            class="submit-button"
            :disabled="postsStore.loading || !content.trim()"
          >
            {{ postsStore.loading ? '相談中...' : '相談する' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePostsStore } from '../stores/posts'
import { useWalletStore } from '../stores/wallet'

const router = useRouter()
const postsStore = usePostsStore()
const walletStore = useWalletStore()

const content = ref('')

// Truncate ETH-style address for display
function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

onMounted(async () => {
  // Ensure wallet exists
  if (!walletStore.isConnected) {
    await walletStore.createWallet()
  }
})

async function handleSubmit() {
  if (!walletStore.walletId) {
    await walletStore.createWallet()
  }

  const post = await postsStore.createPost({
    content: content.value,
    walletId: walletStore.walletId,
  })

  if (post) {
    router.push('/')
  }
}
</script>

<style scoped>
.post-create-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: hsl(var(--background));
}

.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: hsl(var(--background-secondary));
  border-bottom: 1px solid hsl(var(--border));
  flex-shrink: 0;
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

.page-title {
  font-size: var(--font-size-md);
  font-weight: 500;
  color: hsl(var(--foreground));
}

.form-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  overflow: hidden;
}

.error-state {
  padding: var(--space-3);
  margin-bottom: var(--space-4);
  background: hsl(var(--error) / 0.1);
  border: 1px solid hsl(var(--error) / 0.2);
  border-radius: var(--radius-md);
  color: hsl(var(--error));
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

form {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.content-input {
  flex: 1;
  width: 100%;
  padding: var(--space-3);
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
  color: hsl(var(--foreground));
  background: hsl(var(--background-secondary));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  resize: none;
}

.content-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
}

.content-input::placeholder {
  color: hsl(var(--foreground-tertiary));
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-4);
  flex-shrink: 0;
}

.wallet-info {
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
  font-family: monospace;
}

.submit-button {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-sm);
  font-weight: 500;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: opacity var(--transition-normal);
}

.submit-button:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
