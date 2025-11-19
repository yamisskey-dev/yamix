<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useChatStore } from '../stores/chat'

const chatStore = useChatStore()

const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

// メッセージ送信
async function handleSend() {
  if (!inputMessage.value.trim() || chatStore.isLoading) return

  const message = inputMessage.value
  inputMessage.value = ''

  await chatStore.sendMessage(message)
  scrollToBottom()
}

// Enterキーで送信
function handleKeyup(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    handleSend()
  }
}

// 最下部にスクロール
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// メッセージが追加されたら自動スクロール
watch(
  () => chatStore.messages.length,
  () => {
    scrollToBottom()
  }
)

// 時刻フォーマット
function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<template>
  <div class="chat-panel">
    <!-- ヘッダー -->
    <header class="panel-header">
      <div class="header-content">
        <div class="avatar">
          <span>Y</span>
        </div>
        <div class="header-info">
          <h2 class="header-title">Yamii</h2>
          <p class="header-subtitle">人生相談AI</p>
        </div>
      </div>
    </header>

    <!-- メッセージエリア -->
    <div ref="messagesContainer" class="messages-container">
      <!-- ウェルカムメッセージ -->
      <div v-if="!chatStore.hasMessages" class="welcome-message">
        <div class="welcome-icon">
          <span>Y</span>
        </div>
        <h3>Yamiiへようこそ</h3>
        <p>何でも相談してください。</p>
      </div>

      <!-- メッセージ一覧 -->
      <div
        v-for="message in chatStore.messages"
        :key="message.id"
        class="message-wrapper"
        :class="{ 'message-user': message.role === 'user', 'message-assistant': message.role === 'assistant' }"
      >
        <!-- AIアバター -->
        <div v-if="message.role === 'assistant'" class="message-avatar">
          <span>Y</span>
        </div>

        <div class="message-bubble">
          <p class="message-content">{{ message.content }}</p>
          <span class="message-time">{{ formatTime(message.timestamp) }}</span>
        </div>
      </div>

      <!-- ローディング -->
      <div v-if="chatStore.isLoading" class="message-wrapper message-assistant">
        <div class="message-avatar">
          <span>Y</span>
        </div>
        <div class="message-bubble loading">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>

      <!-- エラー表示 -->
      <div v-if="chatStore.error" class="error-message">
        <p>{{ chatStore.error }}</p>
        <button @click="chatStore.clearError()" class="error-dismiss">閉じる</button>
      </div>
    </div>

    <!-- 入力エリア -->
    <div class="input-container">
      <input
        v-model="inputMessage"
        type="text"
        placeholder="メッセージを入力..."
        class="message-input"
        :disabled="chatStore.isLoading"
        @keyup="handleKeyup"
      />
      <button
        class="send-button"
        :disabled="chatStore.isLoading || !inputMessage.trim()"
        @click="handleSend"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* パネル */
.chat-panel {
  height: 100%;
  background: hsl(var(--background));
  display: flex;
  flex-direction: column;
}

/* ヘッダー */
.panel-header {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%);
  color: hsl(var(--primary-foreground));
}

.header-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: hsl(var(--primary-foreground) / 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: 700;
}

.header-info {
  flex: 1;
}

.header-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0;
}

.header-subtitle {
  font-size: var(--font-size-xs);
  opacity: 0.8;
  margin: 2px 0 0;
}

/* メッセージエリア */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ウェルカムメッセージ */
.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: hsl(var(--foreground-secondary));
}

.welcome-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
  box-shadow: var(--shadow-lg);
}

.welcome-icon span {
  font-size: 28px;
  font-weight: 700;
  color: hsl(var(--primary-foreground));
}

.welcome-message h3 {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin: 0 0 var(--space-2);
  color: hsl(var(--foreground));
}

.welcome-message p {
  font-size: var(--font-size-base);
  margin: 0;
  max-width: 280px;
}

/* メッセージ */
.message-wrapper {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  animation: slide-up var(--transition-normal) var(--spring-easing);
}

.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-hover)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-avatar span {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: hsl(var(--primary-foreground));
}

.message-bubble {
  max-width: 75%;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-2xl);
  position: relative;
}

.message-user .message-bubble {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-bottom-right-radius: var(--radius-sm);
}

.message-assistant .message-bubble {
  background: hsl(var(--background-secondary));
  color: hsl(var(--foreground));
  border-bottom-left-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}

.message-content {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  display: block;
  font-size: 9px;
  opacity: 0.6;
  margin-top: var(--space-1);
  text-align: right;
}

/* ローディング */
.loading {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-4);
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--primary));
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* エラー表示 */
.error-message {
  background: hsl(var(--error) / 0.1);
  border: 1px solid hsl(var(--error) / 0.2);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  color: hsl(var(--error));
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.error-message p {
  margin: 0;
}

.error-dismiss {
  background: none;
  border: none;
  color: hsl(var(--error));
  font-size: var(--font-size-xs);
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
  transition: opacity var(--transition-fast);
}

.error-dismiss:hover {
  opacity: 0.7;
}

/* 入力エリア */
.input-container {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3);
  background: hsl(var(--background-secondary));
  border-top: 1px solid hsl(var(--border));
}

.message-input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-full);
  font-size: var(--font-size-base);
  outline: none;
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  transition: all var(--transition-normal) var(--spring-easing);
}

.message-input:focus {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
}

.message-input:disabled {
  background: hsl(var(--item-hover));
  cursor: not-allowed;
}

.message-input::placeholder {
  color: hsl(var(--foreground-tertiary));
}

.send-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: hsl(var(--primary));
  border: none;
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-normal) var(--spring-easing);
}

.send-button:hover:not(:disabled) {
  background: hsl(var(--primary-hover));
  transform: scale(1.05);
}

.send-button:active:not(:disabled) {
  transform: scale(0.95);
}

.send-button:disabled {
  background: hsl(var(--foreground-tertiary));
  cursor: not-allowed;
}
</style>
