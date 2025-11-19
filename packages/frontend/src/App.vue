<template>
  <div class="app-layout three-column">
    <!-- 左サイドバー: ナビゲーション -->
    <aside class="sidebar-left">
      <!-- ロゴ -->
      <div class="app-logo">
        <RouterLink to="/" class="logo-icon">Y</RouterLink>
      </div>

      <!-- 投稿するボタン -->
      <RouterLink to="/posts/new" class="post-button">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"></path>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
        </svg>
        <span>投稿する</span>
      </RouterLink>

      <!-- カテゴリー -->
      <div class="nav-section nav-section-categories">
        <h3 class="nav-section-title">カテゴリー</h3>
        <nav>
          <RouterLink to="/category/column" class="nav-item">コラム</RouterLink>
          <RouterLink to="/category/experience" class="nav-item">体験談</RouterLink>
          <RouterLink to="/category/other" class="nav-item">その他</RouterLink>
        </nav>
      </div>

      <!-- 人気のタグ -->
      <div class="nav-section nav-section-tags">
        <h3 class="nav-section-title">人気のタグ</h3>
        <nav>
          <RouterLink to="/tag/mental-health" class="nav-item tag-item">#メンタルヘルス</RouterLink>
          <RouterLink to="/tag/suicidal-ideation" class="nav-item tag-item">#希死念慮</RouterLink>
          <RouterLink to="/tag/developmental-disorder" class="nav-item tag-item">#発達障害</RouterLink>
        </nav>
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
}

.post-button:hover {
  background: #7e22ce;
}

/* ナビゲーションセクション */
.nav-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
  margin: 0;
}

.nav-section nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: block;
  padding: 8px 12px;
  border-radius: 6px;
  color: #4b5563;
  text-decoration: none;
  font-size: 13px;
  transition: background 0.2s, color 0.2s;
}

.nav-item:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.nav-item.router-link-active {
  background: #f3e8ff;
  color: #9333ea;
}

.tag-item {
  font-size: 12px;
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
  .nav-section-title,
  .nav-item,
  .auth-button {
    display: none;
  }

  .post-button {
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
  }

  .nav-section,
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
