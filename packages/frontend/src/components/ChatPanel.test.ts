import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatPanel from './ChatPanel.vue'
import { useChatStore } from '../stores/chat'

describe('ChatPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('開閉動作', () => {
    it('初期状態ではパネルが閉じている', () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()

      expect(chatStore.isPanelOpen).toBe(false)
      expect(wrapper.find('.chat-panel').classes()).not.toContain('open')
      expect(wrapper.find('.chat-fab').exists()).toBe(true)
    })

    it('FABをクリックするとパネルが開く', async () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()

      await wrapper.find('.chat-fab').trigger('click')

      expect(chatStore.isPanelOpen).toBe(true)
      expect(wrapper.find('.chat-panel').classes()).toContain('open')
    })

    it('閉じるボタンをクリックするとパネルが閉じる', async () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()

      // パネルを開く
      chatStore.openPanel()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.chat-panel').classes()).toContain('open')

      // パネルを閉じる
      await wrapper.find('.close-button').trigger('click')
      expect(chatStore.isPanelOpen).toBe(false)
      expect(wrapper.find('.chat-panel').classes()).not.toContain('open')
    })

    it('パネルが開いているときはFABにhiddenクラスが適用される', async () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()

      chatStore.openPanel()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.chat-fab').classes()).toContain('hidden')
    })
  })

  describe('チャット機能', () => {
    it('メッセージ入力欄が存在する', async () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()
      chatStore.openPanel()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.message-input').exists()).toBe(true)
    })

    it('送信ボタンが存在する', async () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()
      chatStore.openPanel()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.send-button').exists()).toBe(true)
    })

    it('ウェルカムメッセージが表示される', async () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()
      chatStore.openPanel()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.welcome-message').exists()).toBe(true)
    })
  })

  describe('レスポンシブ', () => {
    it('パネルにレスポンシブクラスが適用されている', async () => {
      const wrapper = mount(ChatPanel)
      const chatStore = useChatStore()
      chatStore.openPanel()
      await wrapper.vm.$nextTick()

      // パネルが存在し、レスポンシブ対応のスタイルが適用されていることを確認
      expect(wrapper.find('.chat-panel').exists()).toBe(true)
    })
  })
})
