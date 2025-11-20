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
        <!-- 相談するボタン -->
        <RouterLink to="/posts/new" class="post-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>相談する</span>
        </RouterLink>

        <!-- 人格セクション -->
        <div class="wallet-section">
          <button class="wallet-selector" @click="showWalletMenu = !showWalletMenu">
            <span class="wallet-label">人格</span>
            <span v-if="walletStore.name" class="wallet-name">{{ walletStore.name }}</span>
            <span class="wallet-address">{{ walletStore.address ? truncateAddress(walletStore.address) : '未作成' }}</span>
            <span class="wallet-balance">{{ walletStore.balance }} 承認</span>
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

    <!-- 人格管理メニュー -->
    <div v-if="showWalletMenu" class="wallet-menu-overlay" @click="showWalletMenu = false">
      <div class="wallet-menu" @click.stop>
        <div class="wallet-menu-header">
          <h3>人格管理</h3>
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
              <span class="wallet-item-address">{{ truncateAddress(w.address) }}</span>
              <span class="wallet-item-balance">{{ w.balance }} 承認</span>
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
            人格がありません
          </div>
        </div>
        <div class="wallet-menu-footer">
          <span class="wallet-count">{{ walletStore.walletCount }} / 10 人格</span>
          <button
            class="action-button primary"
            @click="createAndClose()"
            :disabled="!walletStore.canCreateWallet"
          >
            新しい人格を作成
          </button>
        </div>
      </div>
    </div>

    <!-- 削除確認モーダル -->
    <div v-if="walletToDelete" class="wallet-menu-overlay" @click="walletToDelete = null">
      <div class="confirm-modal" @click.stop>
        <h3>人格を削除</h3>
        <p>{{ walletToDelete }} を削除しますか？</p>
        <p class="warning-text">この人格に紐づく全ての相談も削除されます。</p>
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

    <!-- モバイル用ボトムナビゲーション -->
    <nav class="mobile-bottom-nav">
      <RouterLink to="/" class="nav-item" :class="{ active: route.path === '/' }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
        <span>ホーム</span>
      </RouterLink>
      <RouterLink to="/posts/new" class="nav-item" :class="{ active: route.path === '/posts/new' }">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        <span>相談</span>
      </RouterLink>
      <button class="nav-item" :class="{ active: showWalletMenu }" @click="showWalletMenu = !showWalletMenu">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span>人格</span>
      </button>
    </nav>

    <!-- モバイル用AIチャットバブル -->
    <button class="mobile-chat-bubble" @click="showMobileChat = true">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
    </button>

    <!-- モバイル用AIチャットパネル -->
    <div v-if="showMobileChat" class="mobile-chat-overlay" @click="showMobileChat = false">
      <div class="mobile-chat-panel" @click.stop>
        <div class="mobile-chat-header">
          <h3>AIアシスタント</h3>
          <button class="close-button" @click="showMobileChat = false">×</button>
        </div>
        <ChatPanel />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, RouterLink, useRoute } from 'vue-router'
import ChatPanel from './components/ChatPanel.vue'
import { useWalletStore } from './stores/wallet'

const route = useRoute()
const walletStore = useWalletStore()

// Truncate ETH-style address for display
function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const showWalletMenu = ref(false)
const walletToDelete = ref<string | null>(null)
const editingWallet = ref<string | null>(null)
const editingName = ref('')
const showMobileChat = ref(false)

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

/* 相談するボタン */
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
  transition: all var(--transition-normal) var(--spring-easing);
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
}

.post-button:hover {
  background: hsl(var(--primary-hover));
  box-shadow: var(--shadow-md);
}

.post-button:active {
  transform: scale(0.97);
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
  background: hsl(var(--shadow-color) / 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 100px;
  z-index: 100;
  animation: fade-in var(--transition-fast) var(--spring-easing);
}

.wallet-menu {
  background: hsl(var(--background));
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-perfect);
  width: 90%;
  max-width: 400px;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  animation: slide-down var(--transition-slow) var(--spring-easing);
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
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.wallet-count {
  font-size: var(--font-size-xs);
  color: hsl(var(--foreground-tertiary));
  text-align: center;
}

.action-button {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: 500;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-md);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  cursor: pointer;
  transition: all var(--transition-normal) var(--spring-easing);
}

.action-button:hover {
  background: hsl(var(--item-hover));
}

.action-button:active {
  transform: scale(0.97);
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-button:disabled:active {
  transform: none;
}

.action-button.primary {
  width: 100%;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

.action-button.primary:hover:not(:disabled) {
  background: hsl(var(--primary-hover));
}

.action-button.danger {
  background: hsl(var(--error));
  color: white;
  border-color: hsl(var(--error));
}

.action-button.danger:hover:not(:disabled) {
  opacity: 0.9;
}

/* 確認モーダル */
.confirm-modal {
  background: hsl(var(--background));
  border-radius: var(--radius-xl);
  padding: var(--space-4);
  width: 90%;
  max-width: 360px;
  box-shadow: var(--shadow-perfect);
  animation: scale-in var(--transition-normal) var(--spring-bounce);
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
    padding-bottom: 60px; /* ボトムナビの高さ分 */
  }
}

/* モバイル用ボトムナビゲーション */
.mobile-bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: hsl(var(--background-secondary));
  border-top: 1px solid hsl(var(--border));
  z-index: 50;
}

@media (max-width: 768px) {
  .mobile-bottom-nav {
    display: flex;
    justify-content: space-around;
    align-items: center;
  }
}

.mobile-bottom-nav .nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--space-2);
  color: hsl(var(--foreground-tertiary));
  text-decoration: none;
  font-size: 10px;
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  transition: all var(--transition-normal) var(--spring-easing);
  flex: 1;
  height: 100%;
}

.mobile-bottom-nav .nav-item:hover {
  color: hsl(var(--foreground-secondary));
}

.mobile-bottom-nav .nav-item:active {
  transform: scale(0.95);
}

.mobile-bottom-nav .nav-item.active {
  color: hsl(var(--primary));
}

.mobile-bottom-nav .nav-item svg {
  width: 24px;
  height: 24px;
}

/* モバイル用チャットバブル */
.mobile-chat-bubble {
  display: none;
  position: fixed;
  bottom: 80px; /* ボトムナビの上 */
  right: var(--space-4);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  cursor: pointer;
  box-shadow: var(--shadow-lg);
  z-index: 40;
  transition: all var(--transition-normal) var(--spring-easing);
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .mobile-chat-bubble {
    display: flex;
  }
}

.mobile-chat-bubble:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-xl);
}

.mobile-chat-bubble:active {
  transform: scale(0.95);
}

/* モバイル用チャットオーバーレイ */
.mobile-chat-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: hsl(var(--shadow-color) / 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 200;
  animation: fade-in var(--transition-fast) var(--spring-easing);
}

@media (max-width: 768px) {
  .mobile-chat-overlay {
    display: block;
  }
}

.mobile-chat-panel {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  max-width: 400px;
  background: hsl(var(--background));
  display: flex;
  flex-direction: column;
  animation: slide-in-right var(--transition-slow) var(--spring-easing);
}

.mobile-chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid hsl(var(--border));
  background: hsl(var(--background-secondary));
}

.mobile-chat-header h3 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: hsl(var(--foreground));
}

.mobile-chat-panel :deep(.chat-panel) {
  flex: 1;
  height: auto;
}
</style>
