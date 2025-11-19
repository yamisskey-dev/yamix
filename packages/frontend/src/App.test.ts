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
    { path: '/category/:slug', component: { template: '<div>Category</div>' } },
    { path: '/tag/:slug', component: { template: '<div>Tag</div>' } },
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

  describe('サイドバー - ロゴとアクション', () => {
    it('ロゴアイコンが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.app-logo .logo-icon').exists()).toBe(true)
    })

    it('投稿するボタンが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const postButton = wrapper.find('.post-button')
      expect(postButton.exists()).toBe(true)
    })
  })

  describe('サイドバー - カテゴリー', () => {
    it('カテゴリーセクションが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.nav-section-categories').exists()).toBe(true)
    })

    it('コラムカテゴリーリンクが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const links = wrapper.findAll('.nav-section-categories a')
      const columnLink = links.find(link => link.text().includes('コラム'))
      expect(columnLink).toBeDefined()
    })

    it('体験談カテゴリーリンクが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const links = wrapper.findAll('.nav-section-categories a')
      const experienceLink = links.find(link => link.text().includes('体験談'))
      expect(experienceLink).toBeDefined()
    })
  })

  describe('サイドバー - 人気のタグ', () => {
    it('タグセクションが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      expect(wrapper.find('.nav-section-tags').exists()).toBe(true)
    })

    it('メンタルヘルスタグが存在する', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [router],
        },
      })

      const tags = wrapper.findAll('.nav-section-tags a')
      const mentalHealthTag = tags.find(tag => tag.text().includes('メンタルヘルス'))
      expect(mentalHealthTag).toBeDefined()
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
  })
})
