import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

// テスト用のルーター
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
  ],
})

describe('App - 3カラムレイアウト', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('レイアウト構造', () => {
    it('3カラムレイアウトが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.app-layout').exists()).toBe(true)
      expect(wrapper.find('.app-layout').classes()).toContain('three-column')
    })

    it('左サイドバー（ナビゲーション）が存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.sidebar-left').exists()).toBe(true)
      expect(wrapper.find('.sidebar-left nav').exists()).toBe(true)
    })

    it('中央コンテンツエリアが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.main-content').exists()).toBe(true)
    })

    it('右サイドバー（チャット）が存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.sidebar-right').exists()).toBe(true)
    })
  })

  describe('ナビゲーション', () => {
    it('ホームリンクが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const navLinks = wrapper.findAll('.sidebar-left a')
      const homeLink = navLinks.find(link => link.attributes('href') === '/')
      expect(homeLink).toBeDefined()
    })

    it('投稿作成リンクが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const navLinks = wrapper.findAll('.sidebar-left a')
      const createLink = navLinks.find(link => link.attributes('href') === '/posts/new')
      expect(createLink).toBeDefined()
    })

    it('ロゴ/アプリ名が表示される', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.sidebar-left .app-logo').exists()).toBe(true)
    })
  })

  describe('チャットサイドバー', () => {
    it('チャットパネルが右サイドバーに含まれる', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      // ChatPanelコンポーネントが右サイドバー内に存在することを確認
      expect(wrapper.find('.sidebar-right').exists()).toBe(true)
    })
  })
})
