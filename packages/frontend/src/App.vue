<template>
  <div class="app-layout three-column">
    <!-- 左サイドバー: ナビゲーション -->
    <aside class="sidebar-left">
      <!-- ロゴ -->
      <div class="app-logo">
        <RouterLink to="/" class="logo-icon">Y</RouterLink>
      </div>

      <!-- アクションボタン -->
      <div class="action-section">
        <RouterLink to="/posts/new" class="post-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <span>投稿する</span>
        </RouterLink>
        <button class="support-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>支援情報を登録</span>
        </button>
      </div>

      <!-- 認証ボタン -->
      <div class="auth-section">
        <RouterLink to="/login" class="auth-button auth-login">ログイン</RouterLink>
        <RouterLink to="/register" class="auth-button auth-register">会員登録</RouterLink>
      </div>
    </aside>

    <!-- 中央: メインコンテンツ -->
    <main class="main-content">
      <RouterView />
    </main>

    <!-- 右サイドバー: AIチャット -->
    <aside class="sidebar-right">
      <ChatPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import ChatPanel from './components/ChatPanel.vue'
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: #f5f5f5;
}

.three-column {
  display: grid;
  grid-template-columns: 200px 1fr 360px;
}

/* 左サイドバー */
.sidebar-left {
  position: sticky;
  top: 0;
  height: 100vh;
  background: white;
  border-right: 1px solid #e5e5e5;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.app-logo {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  color: white;
  text-decoration: none;
}

/* アクションセクション */
.action-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 投稿するボタン */
.post-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: #9333ea;
  color: white;
  border-radius: 20px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s;
  border: none;
  cursor: pointer;
}

.post-button:hover {
  background: #7e22ce;
}

/* 支援情報を登録ボタン */
.support-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: #f3f4f6;
  color: #374151;
  border-radius: 20px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.2s;
  border: none;
  cursor: pointer;
}

.support-button:hover {
  background: #e5e7eb;
}

/* 認証セクション */
.auth-section {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid #e5e5e5;
}

.auth-button {
  display: block;
  padding: 8px 12px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  transition: background 0.2s;
}

.auth-login {
  color: #4b5563;
  background: #f3f4f6;
}

.auth-login:hover {
  background: #e5e7eb;
}

.auth-register {
  color: white;
  background: #9333ea;
}

.auth-register:hover {
  background: #7e22ce;
}

/* 中央コンテンツ */
.main-content {
  min-height: 100vh;
  border-right: 1px solid #e5e5e5;
}

/* 右サイドバー */
.sidebar-right {
  position: sticky;
  top: 0;
  height: 100vh;
  background: white;
  display: flex;
  flex-direction: column;
}

/* レスポンシブ */
@media (max-width: 1024px) {
  .three-column {
    grid-template-columns: 60px 1fr 320px;
  }

  .sidebar-left {
    padding: 8px;
  }

  .post-button span,
  .support-button span,
  .auth-button {
    display: none;
  }

  .post-button,
  .support-button {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
  }

  .auth-section {
    display: none;
  }
}

@media (max-width: 768px) {
  .three-column {
    grid-template-columns: 1fr;
  }

  .sidebar-left {
    display: none;
  }

  .sidebar-right {
    display: none;
  }

  .main-content {
    border-right: none;
  }
}
</style>
