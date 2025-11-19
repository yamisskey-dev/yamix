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
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
}

/* ヘッダー */
.panel-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);
  color: white;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
}

.header-info {
  flex: 1;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}

.header-subtitle {
  font-size: 11px;
  opacity: 0.8;
  margin: 2px 0 0;
}

/* メッセージエリア */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ウェルカムメッセージ */
.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  color: #666;
}

.welcome-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.welcome-icon span {
  font-size: 28px;
  font-weight: bold;
  color: white;
}

.welcome-message h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #333;
}

.welcome-message p {
  font-size: 13px;
  margin: 0;
  max-width: 280px;
}

/* メッセージ */
.message-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.message-user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-avatar span {
  font-size: 12px;
  font-weight: bold;
  color: white;
}

.message-bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 16px;
  position: relative;
}

.message-user .message-bubble {
  background: #9333ea;
  color: white;
  border-bottom-right-radius: 4px;
}

.message-assistant .message-bubble {
  background: white;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.message-content {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-time {
  display: block;
  font-size: 9px;
  opacity: 0.6;
  margin-top: 4px;
  text-align: right;
}

/* ローディング */
.loading {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 14px;
}

.typing-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9333ea;
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

/* エラー表示 */
.error-message {
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 10px 14px;
  color: #dc2626;
  font-size: 12px;
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
  color: #dc2626;
  font-size: 11px;
  cursor: pointer;
  padding: 4px 8px;
}

.error-dismiss:hover {
  text-decoration: underline;
}

/* 入力エリア */
.input-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: white;
  border-top: 1px solid #e5e5e5;
}

.message-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e5e5e5;
  border-radius: 20px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.message-input:focus {
  border-color: #9333ea;
}

.message-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.send-button {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #9333ea;
  border: none;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
}

.send-button:hover:not(:disabled) {
  background: #7e22ce;
}

.send-button:active:not(:disabled) {
  transform: scale(0.95);
}

.send-button:disabled {
  background: #d1d5db;
  cursor: not-allowed;
}
</style>
