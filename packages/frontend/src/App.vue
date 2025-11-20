<template>
  <div class="app-layout three-column">
    <!-- 左サイドバー: ナビゲーション -->
    <aside class="sidebar-left">
      <!-- ロゴ -->
      <div class="app-logo">
        <RouterLink to="/" class="logo-icon">Y</RouterLink>
      </div>

      <!-- 下部セクション -->
      <div class="bottom-section">
        <!-- 投稿するボタン -->
        <RouterLink to="/posts/new" class="post-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>投稿する</span>
        </RouterLink>

        <!-- ウォレットセクション -->
        <div class="wallet-section">
          <button class="wallet-selector" @click="showWalletMenu = !showWalletMenu">
            <span class="wallet-label">ウォレット</span>
            <span v-if="walletStore.name" class="wallet-name">{{ walletStore.name }}</span>
            <span class="wallet-address">{{ walletStore.address ? '@' + walletStore.address : '未作成' }}</span>
            <span class="wallet-balance">{{ walletStore.balance }} トークン</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- 中央: メインコンテンツ -->
    <main class="main-content">
      <RouterView />
    </main>

    <!-- 右サイドバー: AIチャット -->
    <aside class="sidebar-right">
      <ChatPanel />
    </aside>

    <!-- ウォレット管理メニュー -->
    <div v-if="showWalletMenu" class="wallet-menu-overlay" @click="showWalletMenu = false">
      <div class="wallet-menu" @click.stop>
        <div class="wallet-menu-header">
          <h3>ウォレット管理</h3>
          <button class="close-button" @click="showWalletMenu = false">×</button>
        </div>
        <div class="wallet-list">
          <div
            v-for="w in walletStore.wallets"
            :key="w.id"
            :class="['wallet-item', { active: w.address === walletStore.address }]"
          >
            <button class="wallet-item-main" @click="selectWallet(w.address)">
              <span v-if="w.name" class="wallet-item-name">{{ w.name }}</span>
              <span class="wallet-item-address">@{{ w.address }}</span>
              <span class="wallet-item-balance">{{ w.balance }} トークン</span>
            </button>
            <button
              class="edit-button"
              @click.stop="startEditName(w.address, w.name)"
              title="名前を編集"
            >
              ✎
            </button>
            <button
              class="delete-button"
              @click.stop="confirmDeleteWallet(w.address)"
              title="削除"
            >
              ×
            </button>
          </div>
          <div v-if="walletStore.wallets.length === 0" class="wallet-empty">
            ウォレットがありません
          </div>
        </div>
        <div class="wallet-menu-footer">
          <button class="action-button primary" @click="createAndClose()">
            新しいウォレットを作成
          </button>
        </div>
      </div>
    </div>

    <!-- 削除確認モーダル -->
    <div v-if="walletToDelete" class="wallet-menu-overlay" @click="walletToDelete = null">
      <div class="confirm-modal" @click.stop>
        <h3>ウォレットを削除</h3>
        <p>{{ walletToDelete }} を削除しますか？</p>
        <p class="warning-text">このウォレットに紐づく全ての投稿も削除されます。</p>
        <div class="modal-actions">
          <button class="action-button" @click="walletToDelete = null">キャンセル</button>
          <button class="action-button danger" @click="executeDelete()">削除</button>
        </div>
      </div>
    </div>

    <!-- 名前編集モーダル -->
    <div v-if="editingWallet" class="wallet-menu-overlay" @click="editingWallet = null">
      <div class="confirm-modal" @click.stop>
        <h3>名前を編集</h3>
        <input
          v-model="editingName"
          class="name-input"
          placeholder="名前を入力..."
          @keyup.enter="saveName"
        />
        <div class="modal-actions">
          <button class="action-button" @click="editingWallet = null">キャンセル</button>
          <button class="action-button primary" @click="saveName">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, RouterLink } from 'vue-router'
import ChatPanel from './components/ChatPanel.vue'
import { useWalletStore } from './stores/wallet'

const walletStore = useWalletStore()

const showWalletMenu = ref(false)
const walletToDelete = ref<string | null>(null)
const editingWallet = ref<string | null>(null)
const editingName = ref('')

function selectWallet(address: string) {
  walletStore.switchWallet(address)
  showWalletMenu.value = false
}

async function createAndClose() {
  await walletStore.createWallet()
  showWalletMenu.value = false
}

function confirmDeleteWallet(address: string) {
  walletToDelete.value = address
}

async function executeDelete() {
  if (walletToDelete.value) {
    await walletStore.deleteWallet(walletToDelete.value)
    walletToDelete.value = null
  }
}

function startEditName(address: string, currentName: string | null) {
  editingWallet.value = address
  editingName.value = currentName || ''
}

async function saveName() {
  if (editingWallet.value) {
    await walletStore.updateWalletName(editingWallet.value, editingName.value || null)
    editingWallet.value = null
    editingName.value = ''
  }
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: hsl(var(--background));
}

.three-column {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr var(--chat-panel-width);
}

/* 左サイドバー */
.sidebar-left {
  position: sticky;
  top: 0;
  height: 100vh;
  background: hsl(var(--background-secondary));
  border-right: 1px solid hsl(var(--border));
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  overflow-y: auto;
}

.app-logo {
  display: flex;
  justify-content: center;
  padding: var(--space-1) 0;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: hsl(var(--primary-foreground));
  text-decoration: none;
  box-shadow: var(--shadow-md);
  transition: all var(--transition-normal) var(--spring-easing);
}

.logo-icon:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
}

.logo-icon:active {
  transform: scale(0.98);
}

/* 下部セクション */
.bottom-section {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 投稿するボタン */
.post-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 7px 14px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: 999px;
  text-decoration: none;
  font-size: 95%;
  font-weight: bold;
  transition: background 0.1s ease;
  border: none;
  cursor: pointer;
}

.post-button:hover {
  background: hsl(var(--primary-hover));
}

/* ウォレットセクション */
.wallet-section {
  padding-top: var(--space-3);
  border-top: 1px solid hsl(var(--border));
}

.wallet-selector {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  width: 100%;
  padding: var(--space-2);
  background: hsl(var(--item-hover));
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-normal);
  text-align: left;
}

.wallet-selector:hover {
  background: hsl(var(--item-active));
}

.wallet-label {
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
}

.wallet-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: hsl(var(--foreground));
}

.wallet-address {
  font-size: var(--font-size-xs);
  font-family: monospace;
  color: hsl(var(--foreground-tertiary));
}

.wallet-balance {
  font-size: var(--font-size-xs);
  color: hsl(var(--primary));
  font-weight: 500;
}

/* 中央コンテンツ */
.main-content {
  min-height: 100vh;
  border-right: 1px solid hsl(var(--border));
}

/* 右サイドバー */
.sidebar-right {
  position: sticky;
  top: 0;
  height: 100vh;
  background: hsl(var(--background-secondary));
  display: flex;
  flex-direction: column;
}

/* ウォレットメニュー */
.wallet-menu-overlay {
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

.wallet-menu {
  background: hsl(var(--background));
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 400px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
}

.wallet-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid hsl(var(--border));
}

.wallet-menu-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  color: hsl(var(--foreground));
}

.close-button {
  background: none;
  border: none;
  font-size: var(--font-size-lg);
  color: hsl(var(--foreground-tertiary));
  cursor: pointer;
  padding: var(--space-1);
}

.close-button:hover {
  color: hsl(var(--foreground));
}

.wallet-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}

.wallet-item {
  display: flex;
  align-items: center;
  border-radius: var(--radius-md);
  margin-bottom: var(--space-1);
}

.wallet-item.active {
  background: hsl(var(--primary) / 0.1);
}

.wallet-item-main {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.wallet-item-main:hover {
  background: hsl(var(--item-hover));
  border-radius: var(--radius-md);
}

.wallet-item-name {
  font-weight: 500;
  font-size: var(--font-size-sm);
  color: hsl(var(--foreground));
}

.wallet-item-address {
  font-family: monospace;
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
}

.wallet-item-balance {
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
}

.edit-button {
  padding: var(--space-2);
  background: none;
  border: none;
  color: hsl(var(--foreground-tertiary));
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.edit-button:hover {
  color: hsl(var(--primary));
}

.delete-button {
  padding: var(--space-2);
  background: none;
  border: none;
  color: hsl(var(--foreground-tertiary));
  cursor: pointer;
  font-size: var(--font-size-md);
}

.delete-button:hover {
  color: hsl(var(--error));
}

.name-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background: hsl(var(--background-secondary));
  color: hsl(var(--foreground));
  margin-bottom: var(--space-3);
}

.name-input:focus {
  outline: none;
  border-color: hsl(var(--primary));
}

.wallet-empty {
  padding: var(--space-4);
  text-align: center;
  color: hsl(var(--foreground-tertiary));
  font-size: var(--font-size-sm);
}

.wallet-menu-footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid hsl(var(--border));
}

.action-button {
  padding: var(--space-2) var(--space-3);
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
  width: 100%;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.action-button.primary:hover {
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

/* 確認モーダル */
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

/* レスポンシブ */
@media (max-width: 1024px) {
  .three-column {
    grid-template-columns: var(--sidebar-collapsed-width) 1fr 320px;
  }

  .sidebar-left {
    padding: var(--space-2);
  }

  .post-button span {
    display: none;
  }

  .post-button {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
  }

  .wallet-section {
    display: none;
  }
}

@media (max-width: 768px) {
  .three-column {
    grid-template-columns: 1fr;
  }

  .sidebar-left {
    display: none;
  }

  .sidebar-right {
    display: none;
  }

  .main-content {
    border-right: none;
  }
}
</style>
