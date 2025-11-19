import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore, type ChatMessage } from './chat'
import { yamiiApi } from '../api/yamii'

// yamiiApiをモック
vi.mock('../api/yamii', () => ({
  yamiiApi: {
    sendCounselingMessage: vi.fn(),
  },
}))

describe('useChatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // localStorageをクリア
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('初期状態', () => {
    it('初期状態が正しく設定される', () => {
      const store = useChatStore()

      expect(store.messages).toEqual([])
      expect(store.sessionId).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.userId).toBeTruthy() // ランダム生成されるため存在確認のみ
    })
  })

  describe('sendMessage', () => {
    it('メッセージを送信してレスポンスを受け取る', async () => {
      const store = useChatStore()

      const mockResponse = {
        response: 'AIの応答です',
        session_id: 'session-123',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: [],
        is_crisis: false,
      }

      vi.mocked(yamiiApi.sendCounselingMessage).mockResolvedValueOnce(mockResponse)

      await store.sendMessage('こんにちは')

      // ユーザーメッセージとAIメッセージが追加される
      expect(store.messages).toHaveLength(2)
      expect(store.messages[0].content).toBe('こんにちは')
      expect(store.messages[0].role).toBe('user')
      expect(store.messages[1].content).toBe('AIの応答です')
      expect(store.messages[1].role).toBe('assistant')

      // セッションIDが設定される
      expect(store.sessionId).toBe('session-123')
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('送信中はisLoadingがtrueになる', async () => {
      const store = useChatStore()

      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(yamiiApi.sendCounselingMessage).mockReturnValueOnce(pendingPromise as any)

      const sendPromise = store.sendMessage('テスト')

      // 送信中
      expect(store.isLoading).toBe(true)

      // 応答を返す
      resolvePromise!({
        response: '応答',
        session_id: 'session-123',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: [],
        is_crisis: false,
      })

      await sendPromise

      expect(store.isLoading).toBe(false)
    })

    it('エラー時にerrorが設定される', async () => {
      const store = useChatStore()

      vi.mocked(yamiiApi.sendCounselingMessage).mockRejectedValueOnce(
        new Error('API Error')
      )

      await store.sendMessage('テスト')

      expect(store.error).toBe('API Error')
      expect(store.isLoading).toBe(false)
      // ユーザーメッセージは追加されている
      expect(store.messages).toHaveLength(1)
      expect(store.messages[0].role).toBe('user')
    })

    it('セッションIDが保持される', async () => {
      const store = useChatStore()

      const mockResponse = {
        response: '応答1',
        session_id: 'session-123',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: [],
        is_crisis: false,
      }

      vi.mocked(yamiiApi.sendCounselingMessage).mockResolvedValue(mockResponse)

      await store.sendMessage('メッセージ1')

      // 2回目の送信でセッションIDが含まれる
      await store.sendMessage('メッセージ2')

      const secondCall = vi.mocked(yamiiApi.sendCounselingMessage).mock.calls[1][0]
      expect(secondCall.session_id).toBe('session-123')
    })
  })

  describe('clearMessages', () => {
    it('メッセージをクリアする', async () => {
      const store = useChatStore()

      const mockResponse = {
        response: '応答',
        session_id: 'session-123',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: [],
        is_crisis: false,
      }

      vi.mocked(yamiiApi.sendCounselingMessage).mockResolvedValueOnce(mockResponse)

      await store.sendMessage('テスト')
      expect(store.messages).toHaveLength(2)

      store.clearMessages()

      expect(store.messages).toEqual([])
      expect(store.sessionId).toBeNull()
      expect(store.error).toBeNull()
    })
  })

  describe('getters', () => {
    it('hasMessagesが正しく動作する', async () => {
      const store = useChatStore()

      expect(store.hasMessages).toBe(false)

      const mockResponse = {
        response: '応答',
        session_id: 'session-123',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: [],
        is_crisis: false,
      }

      vi.mocked(yamiiApi.sendCounselingMessage).mockResolvedValueOnce(mockResponse)

      await store.sendMessage('テスト')

      expect(store.hasMessages).toBe(true)
    })

    it('lastMessageが正しく動作する', async () => {
      const store = useChatStore()

      expect(store.lastMessage).toBeNull()

      const mockResponse = {
        response: '最後の応答',
        session_id: 'session-123',
        timestamp: '2024-01-01T00:00:00',
        emotion_analysis: {
          primary_emotion: 'neutral',
          intensity: 5,
          is_crisis: false,
        },
        advice_type: 'supportive',
        follow_up_questions: [],
        is_crisis: false,
      }

      vi.mocked(yamiiApi.sendCounselingMessage).mockResolvedValueOnce(mockResponse)

      await store.sendMessage('テスト')

      expect(store.lastMessage?.content).toBe('最後の応答')
    })
  })
})
