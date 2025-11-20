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
    { path: '/posts/new', component: { template: '<div>New Post</div>' } },
    { path: '/login', component: { template: '<div>Login</div>' } },
    { path: '/register', component: { template: '<div>Register</div>' } },
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

    it('左サイドバーが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.sidebar-left').exists()).toBe(true)
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

  describe('サイドバー - ロゴ', () => {
    it('ロゴアイコンが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.app-logo .logo-icon').exists()).toBe(true)
    })
  })

  describe('サイドバー - アクション', () => {
    it('相談するボタンが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const postButton = wrapper.find('.post-button')
      expect(postButton.exists()).toBe(true)
    })
  })

  describe('サイドバー - 認証', () => {
    it('ログインボタンが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const loginLink = wrapper.find('a[href="/login"]')
      expect(loginLink.exists()).toBe(true)
    })

    it('会員登録ボタンが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const registerLink = wrapper.find('a[href="/register"]')
      expect(registerLink.exists()).toBe(true)
    })

    it('相談ボタンと認証ボタンが下部セクションにある', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      // サイドバー内の下部セクションを確認
      const sidebar = wrapper.find('.sidebar-left')
      const bottomSection = sidebar.find('.bottom-section')
      const authSection = sidebar.find('.auth-section')

      expect(bottomSection.exists()).toBe(true)
      expect(authSection.exists()).toBe(true)
    })
  })
})
