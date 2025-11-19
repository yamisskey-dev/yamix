import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatPanel from './ChatPanel.vue'

describe('ChatPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('レイアウト構造', () => {
    it('パネルが存在する', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.chat-panel').exists()).toBe(true)
    })

    it('ヘッダーが存在する', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.panel-header').exists()).toBe(true)
    })

    it('メッセージコンテナが存在する', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.messages-container').exists()).toBe(true)
    })

    it('入力エリアが存在する', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.input-container').exists()).toBe(true)
    })
  })

  describe('チャット機能', () => {
    it('メッセージ入力欄が存在する', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.message-input').exists()).toBe(true)
    })

    it('送信ボタンが存在する', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.send-button').exists()).toBe(true)
    })

    it('ウェルカムメッセージが表示される', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.welcome-message').exists()).toBe(true)
    })

    it('ウェルカムメッセージにタイトルが含まれる', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.welcome-message h3').text()).toContain('Yamii')
    })
  })

  describe('ヘッダー', () => {
    it('タイトルがYamiiである', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.header-title').text()).toBe('Yamii')
    })

    it('サブタイトルが表示される', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.header-subtitle').text()).toBe('人生相談AI')
    })

    it('アバターが存在する', () => {
      const wrapper = mount(ChatPanel)
      expect(wrapper.find('.avatar').exists()).toBe(true)
    })
  })
})
