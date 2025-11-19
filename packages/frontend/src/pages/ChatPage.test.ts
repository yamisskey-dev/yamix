import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatPage from './ChatPage.vue'
import { useChatStore } from '../stores/chat'
import { yamiiApi } from '../api/yamii'

// yamiiApiをモック
vi.mock('../api/yamii', () => ({
  yamiiApi: {
    sendCounselingMessage: vi.fn(),
  },
}))

describe('ChatPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('初期状態で入力欄と送信ボタンが表示される', () => {
    const wrapper = mount(ChatPage)

    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('メッセージがない時はウェルカムメッセージが表示される', () => {
    const wrapper = mount(ChatPage)

    expect(wrapper.text()).toContain('Yamii')
  })

  it('入力欄にテキストを入力できる', async () => {
    const wrapper = mount(ChatPage)

    const input = wrapper.find('input[type="text"]')
    await input.setValue('テストメッセージ')

    expect((input.element as HTMLInputElement).value).toBe('テストメッセージ')
  })

  it('送信ボタンクリックでメッセージが送信される', async () => {
    const wrapper = mount(ChatPage)
    const store = useChatStore()

    const mockResponse = {
      response: 'AIの応答',
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

    const input = wrapper.find('input[type="text"]')
    await input.setValue('こんにちは')

    const button = wrapper.find('button')
    await button.trigger('click')

    // APIが呼ばれたか確認
    expect(yamiiApi.sendCounselingMessage).toHaveBeenCalled()
  })

  it('Enterキーでメッセージが送信される', async () => {
    const wrapper = mount(ChatPage)

    const mockResponse = {
      response: 'AIの応答',
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

    const input = wrapper.find('input[type="text"]')
    await input.setValue('テスト')
    await input.trigger('keyup', { key: 'Enter' })

    expect(yamiiApi.sendCounselingMessage).toHaveBeenCalled()
  })

  it('空のメッセージは送信されない', async () => {
    const wrapper = mount(ChatPage)

    const button = wrapper.find('button')
    await button.trigger('click')

    expect(yamiiApi.sendCounselingMessage).not.toHaveBeenCalled()
  })

  it('送信後に入力欄がクリアされる', async () => {
    const wrapper = mount(ChatPage)

    const mockResponse = {
      response: 'AIの応答',
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

    const input = wrapper.find('input[type="text"]')
    await input.setValue('テストメッセージ')

    const button = wrapper.find('button')
    await button.trigger('click')

    // 少し待つ
    await wrapper.vm.$nextTick()

    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('メッセージが表示される', async () => {
    const wrapper = mount(ChatPage)
    const store = useChatStore()

    const mockResponse = {
      response: 'AIからの応答メッセージ',
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

    const input = wrapper.find('input[type="text"]')
    await input.setValue('ユーザーメッセージ')

    const button = wrapper.find('button')
    await button.trigger('click')

    // 応答を待つ
    await vi.waitFor(() => {
      const text = wrapper.text()
      expect(text).toContain('ユーザーメッセージ')
      expect(text).toContain('AIからの応答メッセージ')
    })
  })

  it('ローディング中は送信ボタンが無効になる', async () => {
    const wrapper = mount(ChatPage)

    let resolvePromise: (value: any) => void
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve
    })

    vi.mocked(yamiiApi.sendCounselingMessage).mockReturnValueOnce(pendingPromise as any)

    const input = wrapper.find('input[type="text"]')
    await input.setValue('テスト')

    const button = wrapper.find('button')
    await button.trigger('click')

    await wrapper.vm.$nextTick()

    // ローディング中は無効化（disabled属性が存在する）
    expect(button.element.hasAttribute('disabled')).toBe(true)

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

    await vi.waitFor(() => {
      // ローディング完了後、入力が空なのでボタンは引き続き無効
      // ただしisLoadingはfalseになっている
      const store = useChatStore()
      expect(store.isLoading).toBe(false)
    })
  })
})
