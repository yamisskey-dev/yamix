import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { yamiiApi, type CounselingResponse } from '../api/yamii'

/**
 * チャットメッセージ
 */
export interface ChatMessage {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  emotionAnalysis?: {
    primary_emotion: string
    intensity: number
    is_crisis: boolean
  }
}

/**
 * ユーザーIDを生成または取得
 */
function getOrCreateUserId(): string {
  const storageKey = 'yamix_chat_user_id'
  let userId = localStorage.getItem(storageKey)

  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(storageKey, userId)
  }

  return userId
}

/**
 * チャットストア
 */
export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<ChatMessage[]>([])
  const sessionId = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const userId = ref(getOrCreateUserId())
  const isPanelOpen = ref(false)

  // Getters
  const hasMessages = computed(() => messages.value.length > 0)
  const lastMessage = computed(() =>
    messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  )

  // Actions

  /**
   * メッセージを送信
   */
  async function sendMessage(content: string): Promise<void> {
    if (!content.trim()) return

    // エラーをクリア
    error.value = null

    // ユーザーメッセージを追加
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      content: content.trim(),
      role: 'user',
      timestamp: new Date(),
    }
    messages.value.push(userMessage)

    // 送信中状態に
    isLoading.value = true

    try {
      // APIリクエスト
      const response: CounselingResponse = await yamiiApi.sendCounselingMessage({
        message: content.trim(),
        user_id: userId.value,
        session_id: sessionId.value || undefined,
      })

      // セッションIDを保存
      sessionId.value = response.session_id

      // AIメッセージを追加
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        content: response.response,
        role: 'assistant',
        timestamp: new Date(response.timestamp),
        emotionAnalysis: response.emotion_analysis,
      }
      messages.value.push(assistantMessage)

    } catch (err) {
      // エラー処理
      error.value = err instanceof Error ? err.message : '送信に失敗しました'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * メッセージをクリア
   */
  function clearMessages(): void {
    messages.value = []
    sessionId.value = null
    error.value = null
  }

  /**
   * エラーをクリア
   */
  function clearError(): void {
    error.value = null
  }

  /**
   * パネルを開く
   */
  function openPanel(): void {
    isPanelOpen.value = true
  }

  /**
   * パネルを閉じる
   */
  function closePanel(): void {
    isPanelOpen.value = false
  }

  /**
   * パネルの開閉を切り替え
   */
  function togglePanel(): void {
    isPanelOpen.value = !isPanelOpen.value
  }

  return {
    // State
    messages,
    sessionId,
    isLoading,
    error,
    userId,
    isPanelOpen,

    // Getters
    hasMessages,
    lastMessage,

    // Actions
    sendMessage,
    clearMessages,
    clearError,
    openPanel,
    closePanel,
    togglePanel,
  }
})
